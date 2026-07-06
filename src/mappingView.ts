import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SourceMapProvider } from './sourceMapProvider';

interface SourceMapEntry {
  generated_line: number;
  source_file: string;
  source_line: number;
  source_column: number;
  kind?: string;
  symbol_name?: string;
}

export class MappingView {
  private sourceMapProvider: SourceMapProvider;
  private klEditor: vscode.TextEditor | null = null;
  private cEditor: vscode.TextEditor | null = null;
  private klDecorationType: vscode.TextEditorDecorationType;
  private cDecorationType: vscode.TextEditorDecorationType;
  private activeLineDecorationType: vscode.TextEditorDecorationType;
  private isSyncScroll: boolean = true;
  private isUpdating: boolean = false;
  private disposable: vscode.Disposable | null = null;
  private currentMap: SourceMapEntry[] = [];
  private klFilePath: string = '';
  private cFilePath: string = '';

  constructor(smp: SourceMapProvider) {
    this.sourceMapProvider = smp;

    this.klDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(100, 150, 255, 0.15)',
      isWholeLine: true,
      overviewRulerColor: 'rgba(100, 150, 255, 0.5)',
      overviewRulerLane: vscode.OverviewRulerLane.Full
    });

    this.cDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(100, 150, 255, 0.15)',
      isWholeLine: true,
      overviewRulerColor: 'rgba(100, 150, 255, 0.5)',
      overviewRulerLane: vscode.OverviewRulerLane.Full
    });

    this.activeLineDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 200, 100, 0.25)',
      isWholeLine: true,
      overviewRulerColor: 'rgba(255, 200, 100, 0.7)',
      overviewRulerLane: vscode.OverviewRulerLane.Full
    });
  }

  async toggleMappingView(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage('请先打开一个文件');
      return;
    }

    const doc = activeEditor.document;
    if (doc.languageId === 'kaula') {
      await this.openFromKL(activeEditor);
    } else if (doc.languageId === 'c') {
      await this.openFromC(activeEditor);
    } else {
      vscode.window.showWarningMessage('请先打开 Kaula 或 C 文件');
    }
  }

  private async openFromKL(klEditor: vscode.TextEditor): Promise<void> {
    const klPath = klEditor.document.uri.fsPath;
    const klDir = path.dirname(klPath);
    const baseName = path.basename(klPath, '.kl');

    const cPath = await this.findCFile(klPath);
    if (!cPath) {
      vscode.window.showWarningMessage('未找到对应的 C 代码文件，请先编译并确保生成了 source map');
      return;
    }

    const map = this.sourceMapProvider['findMapForKLFile'](klPath);
    if (!map) {
      vscode.window.showWarningMessage('未找到 source map 文件，请先编译并使用 --sourcemap 选项');
      return;
    }

    this.klFilePath = klPath;
    this.cFilePath = cPath;
    this.currentMap = map.entries;

    this.klEditor = klEditor;

    const cUri = vscode.Uri.file(cPath);
    const cDoc = await vscode.workspace.openTextDocument(cUri);
    this.cEditor = await vscode.window.showTextDocument(cDoc, vscode.ViewColumn.Beside);

    this.setupListeners();
    this.updateDecorations();
  }

  private async openFromC(cEditor: vscode.TextEditor): Promise<void> {
    const cPath = cEditor.document.uri.fsPath;

    const map = this.sourceMapProvider['findMapForCFile'](cPath);
    if (!map) {
      vscode.window.showWarningMessage('未找到 source map 文件，请先编译并使用 --sourcemap 选项');
      return;
    }

    const klPath = this.resolveSourcePath(map.source, cPath);
    if (!klPath || !fs.existsSync(klPath)) {
      vscode.window.showWarningMessage('未找到对应的 Kaula 源文件');
      return;
    }

    this.klFilePath = klPath;
    this.cFilePath = cPath;
    this.currentMap = map.entries;

    this.cEditor = cEditor;

    const klUri = vscode.Uri.file(klPath);
    const klDoc = await vscode.workspace.openTextDocument(klUri);
    this.klEditor = await vscode.window.showTextDocument(klDoc, vscode.ViewColumn.Beside);

    this.setupListeners();
    this.updateDecorations();
  }

  private findCFile(klPath: string): string | null {
    const klDir = path.dirname(klPath);
    const baseName = path.basename(klPath, '.kl');

    const cacheDir = path.join(vscode.workspace.rootPath || klDir, 'cache');
    const cachedC = path.join(cacheDir, baseName + '.c');
    if (fs.existsSync(cachedC)) {
      return cachedC;
    }

    const localC = path.join(klDir, baseName + '.c');
    if (fs.existsSync(localC)) {
      return localC;
    }

    return null;
  }

  private resolveSourcePath(sourcePath: string, cPath: string): string | null {
    if (path.isAbsolute(sourcePath) && fs.existsSync(sourcePath)) {
      return sourcePath;
    }

    const cDir = path.dirname(cPath);
    const fromCDir = path.join(cDir, sourcePath);
    if (fs.existsSync(fromCDir)) {
      return fromCDir;
    }

    const workspacePath = path.join(vscode.workspace.rootPath || '', sourcePath);
    if (fs.existsSync(workspacePath)) {
      return workspacePath;
    }

    return null;
  }

  private setupListeners(): void {
    if (this.disposable) {
      this.disposable.dispose();
    }

    const subscriptions: vscode.Disposable[] = [];

    subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (this.isUpdating) { return; }
        if (e.textEditor === this.klEditor || e.textEditor === this.cEditor) {
          this.handleSelectionChange(e.textEditor);
        }
      })
    );

    subscriptions.push(
      vscode.window.onDidChangeVisibleTextEditors(() => {
        this.checkEditorsStillOpen();
      })
    );

    subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.uri.fsPath === this.klFilePath || doc.uri.fsPath === this.cFilePath) {
          this.reloadMap();
        }
      })
    );

    this.disposable = vscode.Disposable.from(...subscriptions);
  }

  private handleSelectionChange(editor: vscode.TextEditor): void {
    this.updateDecorations();

    if (this.isSyncScroll && editor.selections.length > 0) {
      const activeLine = editor.selection.active.line + 1;
      if (editor === this.klEditor && this.cEditor) {
        const cLine = this.klToCLine(activeLine);
        if (cLine > 0) {
          this.isUpdating = true;
          const pos = new vscode.Position(cLine - 1, 0);
          this.cEditor.selection = new vscode.Selection(pos, pos);
          this.cEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          this.isUpdating = false;
        }
      } else if (editor === this.cEditor && this.klEditor) {
        const klLine = this.cToKLLine(activeLine);
        if (klLine > 0) {
          this.isUpdating = true;
          const pos = new vscode.Position(klLine - 1, 0);
          this.klEditor.selection = new vscode.Selection(pos, pos);
          this.klEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          this.isUpdating = false;
        }
      }
    }
  }

  private klToCLine(klLine: number): number {
    let bestLine = 0;
    for (const entry of this.currentMap) {
      if (entry.source_line <= klLine && entry.generated_line > bestLine) {
        bestLine = entry.generated_line;
      }
    }
    return bestLine;
  }

  private cToKLLine(cLine: number): number {
    let bestLine = 0;
    for (const entry of this.currentMap) {
      if (entry.generated_line <= cLine && entry.source_line > bestLine) {
        bestLine = entry.source_line;
      }
    }
    return bestLine;
  }

  private updateDecorations(): void {
    if (!this.klEditor || !this.cEditor) { return; }

    const klRanges: vscode.Range[] = [];
    const cRanges: vscode.Range[] = [];

    for (const entry of this.currentMap) {
      if (entry.source_line > 0 && entry.generated_line > 0) {
        const klLine = entry.source_line - 1;
        const cLine = entry.generated_line - 1;

        if (klLine < this.klEditor.document.lineCount) {
          klRanges.push(new vscode.Range(klLine, 0, klLine, 0));
        }
        if (cLine < this.cEditor.document.lineCount) {
          cRanges.push(new vscode.Range(cLine, 0, cLine, 0));
        }
      }
    }

    this.klEditor.setDecorations(this.klDecorationType, klRanges);
    this.cEditor.setDecorations(this.cDecorationType, cRanges);

    if (vscode.window.activeTextEditor === this.klEditor && this.klEditor.selections.length > 0) {
      const klActiveLine = this.klEditor.selection.active.line;
      const klActiveRange = [new vscode.Range(klActiveLine, 0, klActiveLine, 0)];
      this.klEditor.setDecorations(this.activeLineDecorationType, klActiveRange);

      const cLine = this.klToCLine(klActiveLine + 1);
      if (cLine > 0 && this.cEditor) {
        const cActiveRange = [new vscode.Range(cLine - 1, 0, cLine - 1, 0)];
        this.cEditor.setDecorations(this.activeLineDecorationType, cActiveRange);
      } else if (this.cEditor) {
        this.cEditor.setDecorations(this.activeLineDecorationType, []);
      }
    } else if (vscode.window.activeTextEditor === this.cEditor && this.cEditor.selections.length > 0) {
      const cActiveLine = this.cEditor.selection.active.line;
      const cActiveRange = [new vscode.Range(cActiveLine, 0, cActiveLine, 0)];
      this.cEditor.setDecorations(this.activeLineDecorationType, cActiveRange);

      const klLine = this.cToKLLine(cActiveLine + 1);
      if (klLine > 0 && this.klEditor) {
        const klActiveRange = [new vscode.Range(klLine - 1, 0, klLine - 1, 0)];
        this.klEditor.setDecorations(this.activeLineDecorationType, klActiveRange);
      } else if (this.klEditor) {
        this.klEditor.setDecorations(this.activeLineDecorationType, []);
      }
    }
  }

  private reloadMap(): void {
    const map = this.sourceMapProvider['findMapForKLFile'](this.klFilePath);
    if (map) {
      this.currentMap = map.entries;
      this.updateDecorations();
    }
  }

  private checkEditorsStillOpen(): void {
    const visibleEditors = vscode.window.visibleTextEditors;
    const klVisible = this.klEditor && visibleEditors.includes(this.klEditor);
    const cVisible = this.cEditor && visibleEditors.includes(this.cEditor);

    if (!klVisible || !cVisible) {
      this.clearDecorations();
      if (this.disposable) {
        this.disposable.dispose();
        this.disposable = null;
      }
      this.klEditor = null;
      this.cEditor = null;
    }
  }

  private clearDecorations(): void {
    if (this.klEditor) {
      this.klEditor.setDecorations(this.klDecorationType, []);
      this.klEditor.setDecorations(this.activeLineDecorationType, []);
    }
    if (this.cEditor) {
      this.cEditor.setDecorations(this.cDecorationType, []);
      this.cEditor.setDecorations(this.activeLineDecorationType, []);
    }
  }

  setSyncScroll(enabled: boolean): void {
    this.isSyncScroll = enabled;
  }

  dispose(): void {
    this.clearDecorations();
    if (this.disposable) {
      this.disposable.dispose();
    }
    this.klDecorationType.dispose();
    this.cDecorationType.dispose();
    this.activeLineDecorationType.dispose();
  }
}
