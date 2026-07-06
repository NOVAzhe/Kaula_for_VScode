import * as vscode from 'vscode';

export class RenameProvider implements vscode.RenameProvider {
  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    token: vscode.CancellationToken
  ): vscode.WorkspaceEdit | null {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) { return null; }

    const oldName = document.getText(wordRange);
    if (!oldName || oldName === newName) { return null; }

    const edit = new vscode.WorkspaceEdit();
    const text = document.getText();
    const regex = new RegExp(`\\b${oldName}\\b`, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const pos = document.positionAt(match.index);
      const line = document.lineAt(pos.line);

      if (this.isInStringOrComment(line, pos)) {
        continue;
      }

      const range = new vscode.Range(pos, pos.translate(0, oldName.length));
      edit.replace(document.uri, range, newName);
    }

    return edit;
  }

  private isInStringOrComment(line: vscode.TextLine, pos: vscode.Position): boolean {
    const lineText = line.text.substring(0, pos.character);

    if (lineText.includes('//') || lineText.includes('#')) {
      const commentIndex = Math.min(
        lineText.indexOf('//') >= 0 ? lineText.indexOf('//') : Infinity,
        lineText.indexOf('#') >= 0 ? lineText.indexOf('#') : Infinity
      );
      if (commentIndex < pos.character) {
        return true;
      }
    }

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
