import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class KaulaFormatProvider implements vscode.DocumentFormattingEditProvider {

  private resolveKaulafmt(): string | null {
    // 1. user configured path (re-read every time)
    const config = vscode.workspace.getConfiguration('kaula');
    const configuredPath = config.get<string>('format.kaulafmtPath', '');
    if (configuredPath && this.isValidPath(configuredPath)) {
      return configuredPath;
    }

    // 2. search workspace folders
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        const candidates = [
          path.join(folder.uri.fsPath, 'kaula', 'kaula-compiler', 'kaulafmt.exe'),
          path.join(folder.uri.fsPath, 'kaula', 'kaula-compiler', 'cmd', 'kaulafmt', 'kaulafmt.exe'),
          path.join(folder.uri.fsPath, 'kaulafmt.exe'),
          path.join(folder.uri.fsPath, 'bin', 'kaulafmt.exe'),
        ];
        for (const c of candidates) {
          if (this.isValidPath(c)) return c;
        }
      }
    }

    // 3. try relative positions from extension's out/ dir
    const outDir = path.dirname(__filename);
    const candidates2 = [
      path.join(outDir, '..', '..', '..', '..', 'kaula', 'kaula-compiler', 'kaulafmt.exe'),
      path.join(outDir, '..', '..', '..', '..', 'kaula', 'kaula-compiler', 'cmd', 'kaulafmt', 'kaulafmt.exe'),
      path.join(outDir, '..', 'bin', 'kaulafmt.exe'),
    ];
    for (const c of candidates2) {
      const resolved = path.resolve(c);
      if (this.isValidPath(resolved)) return resolved;
    }

    // 4. try PATH
    try {
      const which = process.platform === 'win32' ? 'where' : 'which';
      const result = child_process.execSync(`${which} kaulafmt`, { encoding: 'utf-8', timeout: 3000 }).trim();
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

  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): Promise<vscode.TextEdit[]> {
    const kaulafmtPath = this.resolveKaulafmt();
    if (!kaulafmtPath) {
      vscode.window.showWarningMessage('kaulafmt 未找到，请在设置中配置 kaula.format.kaulafmtPath');
      return [];
    }

    const text = document.getText();
    if (!text.trim()) {
      return [];
    }

    try {
      const formatted = await this.runKaulafmt(kaulafmtPath, text, document);
      if (formatted === text) {
        return [];
      }

      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length)
      );

      return [new vscode.TextEdit(fullRange, formatted)];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`格式化失败: ${errorMsg}`);
      return [];
    }
  }

  private runKaulafmt(kaulafmtPath: string, text: string, document: vscode.TextDocument): Promise<string> {
    return new Promise((resolve, reject) => {
      const cp = child_process.execFile(kaulafmtPath, [], {
        cwd: path.dirname(document.uri.fsPath),
        maxBuffer: 10 * 1024 * 1024
      }, (err, stdout, stderr) => {
        if (err) {
          if (stderr.includes("Error reading file")) {
            reject(new Error("无法读取文件"));
          } else if (stderr.includes("Failed to parse")) {
            reject(new Error("语法错误，无法格式化"));
          } else {
            reject(new Error(stderr || err.message));
          }
          return;
        }
        resolve(stdout.trim());
      });

      cp.stdin?.write(text);
      cp.stdin?.end();
    });
  }
}
