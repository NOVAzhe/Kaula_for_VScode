import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class BuildProvider implements vscode.Disposable {
  private outputChannel: vscode.OutputChannel;
  private onBuildSuccess: (() => void) | null = null;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Kaula Build');
  }

  setOnBuildSuccess(callback: () => void): void {
    this.onBuildSuccess = callback;
  }

  private resolveKaulac(): string | null {
    // 1. user configured path (re-read every time)
    const config = vscode.workspace.getConfiguration('kaula');
    const configuredPath = config.get<string>('build.kaulacPath', '');
    if (configuredPath && this.isValidPath(configuredPath)) {
      return configuredPath;
    }

    // 2. search workspace folders
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        const candidates = [
          path.join(folder.uri.fsPath, 'kaula', 'kaula-compiler', 'kaulac.exe'),
          path.join(folder.uri.fsPath, 'kaula', 'kaula-compiler', 'cmd', 'kaulac', 'kaulac.exe'),
          path.join(folder.uri.fsPath, 'kaulac.exe'),
          path.join(folder.uri.fsPath, 'bin', 'kaulac.exe'),
        ];
        for (const c of candidates) {
          if (this.isValidPath(c)) return c;
        }
      }
    }

    // 3. try common relative positions from this extension's out/ dir
    const outDir = path.dirname(__filename);
    const candidates2 = [
      path.join(outDir, '..', '..', '..', '..', 'kaula', 'kaula-compiler', 'kaulac.exe'),
      path.join(outDir, '..', '..', '..', '..', 'kaula', 'kaula-compiler', 'cmd', 'kaulac', 'kaulac.exe'),
      path.join(outDir, '..', 'bin', 'kaulac.exe'),
    ];
    for (const c of candidates2) {
      const resolved = path.resolve(c);
      if (this.isValidPath(resolved)) return resolved;
    }

    // 4. try PATH
    try {
      const which = process.platform === 'win32' ? 'where' : 'which';
      const result = child_process.execSync(`${which} kaulac`, { encoding: 'utf-8', timeout: 3000 }).trim();
      if (result && this.isValidPath(result)) return result;
    } catch {}

    return null;
  }

  private isValidPath(p: string): boolean {
    try {
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

    const kaulacPath = this.resolveKaulac();
    if (!kaulacPath) {
      vscode.window.showErrorMessage('kaulac 编译器未找到，请在设置中配置 kaula.build.kaulacPath');
      return;
    }

    const filePath = document.uri.fsPath;
    const fileDir = path.dirname(filePath);
    const baseName = path.basename(filePath, '.kl');

    // save document first
    await document.save();

    const config = vscode.workspace.getConfiguration('kaula');
    const args = [filePath];
    if (config.get<boolean>('build.sor', false)) {
      args.push('--sor');
    }
    if (config.get<boolean>('build.sourceMap', true)) {
      args.push('--sourcemap');
    }

    this.outputChannel.clear();
    this.outputChannel.show(true);
    this.outputChannel.appendLine(`> ${kaulacPath} ${args.join(' ')}\n`);

    return new Promise<void>((resolve) => {
      child_process.execFile(kaulacPath, args, {
        cwd: fileDir,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
      }, (err, stdout, stderr) => {
        if (stdout) this.outputChannel.appendLine(stdout);
        if (stderr) this.outputChannel.appendLine(stderr);

        if (err) {
          this.outputChannel.appendLine(`\n❌ 编译失败 (exit code: ${err.code})`);
          vscode.window.showErrorMessage('编译失败，查看输出面板');
          resolve();
          return;
        }

        this.outputChannel.appendLine('\n✅ 编译成功');

        // auto show mapping view after successful build
        if (this.onBuildSuccess) {
          setTimeout(() => this.onBuildSuccess!(), 300);
        }
        resolve();
      });
    });
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

    const kaulacPath = this.resolveKaulac();
    if (!kaulacPath) {
      vscode.window.showErrorMessage('kaulac 编译器未找到，请在设置中配置 kaula.build.kaulacPath');
      return;
    }

    const filePath = document.uri.fsPath;
    const fileDir = path.dirname(filePath);
    const baseName = path.basename(filePath, '.kl');
    const exePath = path.join(fileDir, baseName + '.exe');

    await document.save();

    const config = vscode.workspace.getConfiguration('kaula');
    const args = [filePath];
    if (config.get<boolean>('build.sor', false)) {
      args.push('--sor');
    }
    if (config.get<boolean>('build.sourceMap', true)) {
      args.push('--sourcemap');
    }

    this.outputChannel.clear();
    this.outputChannel.show(true);
    this.outputChannel.appendLine(`> ${kaulacPath} ${args.join(' ')}\n`);

    return new Promise<void>((resolve) => {
      child_process.execFile(kaulacPath, args, {
        cwd: fileDir,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
      }, (err, stdout, stderr) => {
        if (stdout) this.outputChannel.appendLine(stdout);
        if (stderr) this.outputChannel.appendLine(stderr);

        if (err) {
          this.outputChannel.appendLine(`\n❌ 编译失败 (exit code: ${err.code})`);
          vscode.window.showErrorMessage('编译失败，查看输出面板');
          resolve();
          return;
        }

        this.outputChannel.appendLine('\n✅ 编译成功，运行中...\n');

        // run the executable
        if (this.isValidPath(exePath)) {
          const term = vscode.window.createTerminal('Kaula Run');
          term.show(true);
          term.sendText(`"${exePath}"`);
        } else {
          this.outputChannel.appendLine(`❌ 未找到可执行文件: ${exePath}`);
        }

        if (this.onBuildSuccess) {
          setTimeout(() => this.onBuildSuccess!(), 300);
        }
        resolve();
      });
    });
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
