import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';

export class KaulaFormatProvider implements vscode.DocumentFormattingEditProvider {
  private kaulafmtPath: string | null = null;

  constructor() {
    this.findKaulafmt();
  }

  private findKaulafmt(): void {
    const config = vscode.workspace.getConfiguration('kaula');
    const configuredPath = config.get<string>('format.kaulafmtPath', '');

    if (configuredPath && this.isValidPath(configuredPath)) {
      this.kaulafmtPath = configuredPath;
      return;
    }

    const toolkitPath = path.join(__dirname, '../../../../kaula/kaula-compiler/cmd/kaulafmt/kaulafmt.exe');
    if (this.isValidPath(toolkitPath)) {
      this.kaulafmtPath = toolkitPath;
      return;
    }

    const extPath = path.join(__dirname, '../bin/kaulafmt.exe');
    if (this.isValidPath(extPath)) {
      this.kaulafmtPath = extPath;
      return;
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

  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): Promise<vscode.TextEdit[]> {
    if (!this.kaulafmtPath) {
      vscode.window.showWarningMessage('kaulafmt 未找到，请在设置中配置 kaula.format.kaulafmtPath');
      return [];
    }

    const text = document.getText();
    if (!text.trim()) {
      return [];
    }

    try {
      const formatted = await this.runKaulafmt(text);
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

  private runKaulafmt(text: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cp = child_process.execFile(this.kaulafmtPath!, [], {
        cwd: vscode.workspace.rootPath || process.cwd(),
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
