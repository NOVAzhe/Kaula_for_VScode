import * as vscode from 'vscode';

export class ReferenceProvider implements vscode.ReferenceProvider {
  private document: vscode.TextDocument | null = null;

  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    options: { includeDeclaration: boolean },
    token: vscode.CancellationToken
  ): vscode.Location[] | null {
    this.document = document;
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) { return null; }

    const word = document.getText(wordRange);
    const references: vscode.Location[] = [];

    // 查找所有引用
    const text = document.getText();
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const pos = document.positionAt(match.index);
      const line = document.lineAt(pos.line);
      
      // 排除字符串和注释中的引用
      if (this.isInStringOrComment(line, pos)) {
        continue;
      }

      references.push(new vscode.Location(document.uri, new vscode.Position(pos.line, pos.character)));
    }

    return references.length > 0 ? references : null;
  }

  private isInStringOrComment(line: vscode.TextLine, pos: vscode.Position): boolean {
    const lineText = line.text.substring(0, pos.character);
    
    // 检查是否在注释中
    if (lineText.includes('//') || lineText.includes('#')) {
      const commentIndex = Math.min(
        lineText.indexOf('//') >= 0 ? lineText.indexOf('//') : Infinity,
        lineText.indexOf('#') >= 0 ? lineText.indexOf('#') : Infinity
      );
      if (commentIndex < pos.character) {
        return true;
      }
    }

    // 检查是否在字符串中
    let inString = false;
    let escape = false;
    for (let i = 0; i < lineText.length; i++) {
      const ch = lineText[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
      }
    }
    return inString;
  }
}
