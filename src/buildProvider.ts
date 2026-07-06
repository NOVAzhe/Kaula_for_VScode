import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';

export class BuildProvider {
  private terminal: vscode.Terminal | null = null;
  private kaulacPath: string | null = null;

  constructor() {
    this.findKaulac();
  }

  private findKaulac(): void {
    const config = vscode.workspace.getConfiguration('kaula');
    const configuredPath = config.get<string>('build.kaulacPath', '');

    if (configuredPath && this.isValidPath(configuredPath)) {
      this.kaulacPath = configuredPath;
      return;
    }

    const toolkitPath = path.join(__dirname, '../../../../kaula/kaula-compiler/cmd/kaulac/kaulac.exe');
    if (this.isValidPath(toolkitPath)) {
      this.kaulacPath = toolkitPath;
      return;
    }

    const extPath = path.join(__dirname, '../bin/kaulac.exe');
    if (this.isValidPath(extPath)) {
      this.kaulacPath = extPath;
    }
  }

  private isValidPath(p: string): boolean {
    try {
      const fs = require('fs');
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }

  async build(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('请先打开一个 Kaula 文件');
      return;
    }

    const document = editor.document;
    if (document.languageId !== 'kaula') {
      vscode.window.showWarningMessage('当前文件不是 Kaula 文件');
      return;
    }

    if (!this.kaulacPath) {
      vscode.window.showErrorMessage('kaulac 编译器未找到，请在设置中配置 kaula.build.kaulacPath');
      return;
    }

    const filePath = document.uri.fsPath;
    const args = [filePath];

    const config = vscode.workspace.getConfiguration('kaula');
    if (config.get<boolean>('build.sor', false)) {
      args.push('--sor');
    }
    if (config.get<boolean>('build.sourceMap', true)) {
      args.push('--sourcemap');
    }

    this.showTerminal();
    this.terminal!.sendText(`${this.kaulacPath} ${args.join(' ')}`, true);
  }

  async run(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('请先打开一个 Kaula 文件');
      return;
    }

    const document = editor.document;
    if (document.languageId !== 'kaula') {
      vscode.window.showWarningMessage('当前文件不是 Kaula 文件');
      return;
    }

    if (!this.kaulacPath) {
      vscode.window.showErrorMessage('kaulac 编译器未找到，请在设置中配置 kaula.build.kaulacPath');
      return;
    }

    const filePath = document.uri.fsPath;
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, '.kl');
    const exePath = path.join(dir, baseName + '.exe');

    const config = vscode.workspace.getConfiguration('kaula');
    const args = [filePath];
    if (config.get<boolean>('build.sor', false)) {
      args.push('--sor');
    }
    if (config.get<boolean>('build.sourceMap', true)) {
      args.push('--sourcemap');
    }

    this.showTerminal();
    this.terminal!.sendText(`${this.kaulacPath} ${args.join(' ')} && ${exePath}`, true);
  }

  private showTerminal(): void {
    if (!this.terminal) {
      this.terminal = vscode.window.createTerminal('Kaula');
    }
    this.terminal.show(true);
  }

  dispose(): void {
    if (this.terminal) {
      this.terminal.dispose();
    }
  }
}
