import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class CompilerDiagnosticsProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('kaula-compiler');
  }

  private resolveKaulac(): string | null {
    const config = vscode.workspace.getConfiguration('kaula');
    const configuredPath = config.get<string>('build.kaulacPath', '');
    if (configuredPath && this.isValidPath(configuredPath)) return configuredPath;

    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        const candidates = [
          path.join(folder.uri.fsPath, 'kaula', 'kaula-compiler', 'kaulac.exe'),
          path.join(folder.uri.fsPath, 'kaula', 'kaula-compiler', 'cmd', 'kaulac', 'kaulac.exe'),
          path.join(folder.uri.fsPath, 'kaulac.exe'),
        ];
        for (const c of candidates) {
          if (this.isValidPath(c)) return c;
        }
      }
    }

    const outDir = path.dirname(__filename);
    const candidates2 = [
      path.join(outDir, '..', '..', '..', '..', 'kaula', 'kaula-compiler', 'kaulac.exe'),
      path.join(outDir, '..', '..', '..', '..', 'kaula', 'kaula-compiler', 'cmd', 'kaulac', 'kaulac.exe'),
    ];
    for (const c of candidates2) {
      const resolved = path.resolve(c);
      if (this.isValidPath(resolved)) return resolved;
    }

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

  async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    const kaulacPath = this.resolveKaulac();
    if (!kaulacPath) {
      return;
    }

    const filePath = document.uri.fsPath;
    const diagnostics: vscode.Diagnostic[] = [];

    try {
      const output = await this.runCompiler(kaulacPath, filePath);
      diagnostics.push(...this.parseErrors(output, document));
    } catch (err) {
      // 编译失败是正常的（代码可能有错误）
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private runCompiler(kaulacPath: string, filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      child_process.execFile(kaulacPath, [filePath, '--check'], {
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
