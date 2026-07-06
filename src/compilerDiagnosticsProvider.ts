import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';

export class CompilerDiagnosticsProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private kaulacPath: string | null = null;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('kaula-compiler');
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

  async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    if (!this.kaulacPath) {
      return;
    }

    const filePath = document.uri.fsPath;
    const diagnostics: vscode.Diagnostic[] = [];

    try {
      const output = await this.runCompiler(filePath);
      diagnostics.push(...this.parseErrors(output, document));
    } catch (err) {
      // 编译失败是正常的（代码可能有错误）
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private runCompiler(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      child_process.execFile(this.kaulacPath!, [filePath, '--check'], {
        cwd: path.dirname(filePath),
        maxBuffer: 10 * 1024 * 1024
      }, (err, stdout, stderr) => {
        if (err) {
          resolve(stderr || stdout);
          return;
        }
        resolve(stdout);
      });
    });
  }

  private parseErrors(output: string, document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/(\d+):(\d+):\s*([^:]+):\s*(.+)/);
      if (match) {
        const lineNum = parseInt(match[1]) - 1;
        const colNum = parseInt(match[2]) - 1;
        const errorType = match[3].trim();
        const message = match[4].trim();

        if (lineNum >= 0 && lineNum < document.lineCount) {
          const severity = this.getSeverity(errorType);
          const range = new vscode.Range(lineNum, colNum, lineNum, colNum + 1);
          const diagnostic = new vscode.Diagnostic(range, message, severity);
          diagnostic.source = 'kaula-compiler';
          diagnostics.push(diagnostic);
        }
      }

      // 另一种格式：Found X error(s):
      const foundMatch = line.match(/Found\s+(\d+)\s+error/);
      if (foundMatch) {
        continue;
      }
    }

    return diagnostics;
  }

  private getSeverity(type: string): vscode.DiagnosticSeverity {
    const upperType = type.toUpperCase();
    if (upperType.includes('WARNING')) {
      return vscode.DiagnosticSeverity.Warning;
    }
    if (upperType.includes('ERROR')) {
      return vscode.DiagnosticSeverity.Error;
    }
    return vscode.DiagnosticSeverity.Error;
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
