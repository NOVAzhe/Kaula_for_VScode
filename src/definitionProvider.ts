import * as vscode from 'vscode';
import { FuncInfo, VarInfo } from './typeProvider';

export class DefinitionProvider implements vscode.DefinitionProvider {
  private functions: Map<string, FuncInfo>;
  private variables: Map<string, VarInfo[]>;

  constructor(functions: Map<string, FuncInfo>, variables: Map<string, VarInfo[]>) {
    this.functions = functions;
    this.variables = variables;
  }

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.Definition | vscode.LocationLink[] | null {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) { return null; }

    const word = document.getText(wordRange);
    const lineText = document.lineAt(position).text;
    const textBefore = lineText.substring(0, wordRange.start.character);

    // 1. 检查 std.module.func 调用
    const stdFuncMatch = textBefore.match(/std\.(\w+)\.$/);
    if (stdFuncMatch) {
      const modName = stdFuncMatch[1];
      const modFunc = `std.${modName}.${word}`;
      const funcInfo = this.functions.get(modFunc);
      if (funcInfo) {
        return this.createLocation(document, funcInfo.line, word);
      }
    }

    // 2. 检查普通函数调用
    const callMatch = textBefore.match(/([a-zA-Z_]\w*)\s*\(\s*$/);
    if (callMatch) {
      const funcName = callMatch[1];
      const funcInfo = this.functions.get(funcName);
      if (funcInfo && !funcInfo.isStdlib) {
        return this.createLocation(document, funcInfo.line, word);
      }
    }

    // 3. 检查变量引用
    const varInfos = this.variables.get(word);
    if (varInfos && varInfos.length > 0) {
      const varInfo = varInfos[varInfos.length - 1];
      return this.createLocation(document, varInfo.line, word);
    }

    // 4. 检查函数声明中的函数名
    const funcInfo = this.functions.get(word);
    if (funcInfo && !funcInfo.isStdlib) {
      return this.createLocation(document, funcInfo.line, word);
    }

    return null;
  }

  private createLocation(document: vscode.TextDocument, line: number, word: string): vscode.Location {
    if (line < 0 || line >= document.lineCount) {
      return new vscode.Location(document.uri, new vscode.Position(0, 0));
    }

    const lineText = document.lineAt(line).text;
    const wordIndex = lineText.indexOf(word);
    if (wordIndex >= 0) {
      return new vscode.Location(
        document.uri,
        new vscode.Range(line, wordIndex, line, wordIndex + word.length)
      );
    }

    return new vscode.Location(document.uri, new vscode.Position(line, 0));
  }

  update(functions: Map<string, FuncInfo>, variables: Map<string, VarInfo[]>): void {
    this.functions = functions;
    this.variables = variables;
  }
}
