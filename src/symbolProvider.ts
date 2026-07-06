import * as vscode from 'vscode';

export class SymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.SymbolInformation[] | vscode.DocumentSymbol[] | null {
    const symbols: vscode.DocumentSymbol[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) {
        continue;
      }

      // fn name(params) ReturnType {
      const funcMatch = line.match(/^fn\s+([a-zA-Z_]\w*)\s*\(/);
      if (funcMatch) {
        const name = funcMatch[1];
        const range = this.findRange(document, i, name);
        const detail = line.substring(line.indexOf('('), line.indexOf('{') + 1);
        symbols.push(new vscode.DocumentSymbol(
          name,
          detail,
          vscode.SymbolKind.Function,
          range,
          range
        ));
        continue;
      }

      // struct name {
      const structMatch = line.match(/^struct\s+([a-zA-Z_]\w*)/);
      if (structMatch) {
        const name = structMatch[1];
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          'struct',
          vscode.SymbolKind.Struct,
          range,
          range
        ));
        continue;
      }

      // class name {
      const classMatch = line.match(/^class\s+([a-zA-Z_]\w*)/);
      if (classMatch) {
        const name = classMatch[1];
        const range = this.findRange(document, i, name);
        const impMatch = line.match(/implements\s+(.+)/);
        const detail = impMatch ? `class implements ${impMatch[1]}` : 'class';
        symbols.push(new vscode.DocumentSymbol(
          name,
          detail,
          vscode.SymbolKind.Class,
          range,
          range
        ));
        continue;
      }

      // interface name {
      const interfaceMatch = line.match(/^interface\s+([a-zA-Z_]\w*)/);
      if (interfaceMatch) {
        const name = interfaceMatch[1];
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          'interface',
          vscode.SymbolKind.Interface,
          range,
          range
        ));
        continue;
      }

      // type name = ...
      const typeMatch = line.match(/^type\s+([a-zA-Z_]\w*)/);
      if (typeMatch) {
        const name = typeMatch[1];
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          'type alias',
          vscode.SymbolKind.TypeParameter,
          range,
          range
        ));
        continue;
      }

      // prefix name {
      const prefixMatch = line.match(/^prefix\s+([a-zA-Z_]\w*)/);
      if (prefixMatch) {
        const name = prefixMatch[1];
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          'prefix',
          vscode.SymbolKind.Module,
          range,
          range
        ));
        continue;
      }

      // pub Type name
      const pubMatch = line.match(/^pub\s+([a-zA-Z_]\w+)\s+([a-zA-Z_]\w*)/);
      if (pubMatch) {
        const name = pubMatch[2];
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          `pub ${pubMatch[1]}`,
          vscode.SymbolKind.Variable,
          range,
          range
        ));
      }
    }

    return symbols;
  }

  private findRange(document: vscode.TextDocument, line: number, name: string): vscode.Range {
    const lineText = document.lineAt(line).text;
    const startChar = lineText.indexOf(name);
    if (startChar >= 0) {
      return new vscode.Range(
        line, startChar,
        line, startChar + name.length
      );
    }
    return new vscode.Range(line, 0, line, lineText.length);
  }
}
