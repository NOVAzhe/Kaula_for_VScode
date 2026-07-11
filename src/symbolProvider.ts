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

      // constructor(params) {
      const ctorMatch = line.match(/^constructor\s*\(/);
      if (ctorMatch) {
        const range = this.findRange(document, i, 'constructor');
        symbols.push(new vscode.DocumentSymbol(
          'constructor',
          line.substring(line.indexOf('('), line.indexOf('{') + 1),
          vscode.SymbolKind.Constructor,
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

      // enum name {
      const enumMatch = line.match(/^enum\s+([a-zA-Z_]\w*)/);
      if (enumMatch) {
        const name = enumMatch[1];
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          'enum',
          vscode.SymbolKind.Enum,
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

      // static name = value / static Type name = value
      const staticMatch = line.match(/^static\s+(?:[a-zA-Z_]\w*\s+)?([a-zA-Z_]\w*)\s*(?:=|;)/);
      if (staticMatch) {
        const name = staticMatch[1];
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          'static',
          vscode.SymbolKind.Variable,
          range,
          range
        ));
      }

      // extern fn name(params) -> ret
      const externFnMatch = line.match(/^extern\s+fn\s+([a-zA-Z_]\w*)\s*\(/);
      if (externFnMatch) {
        const name = externFnMatch[1];
        const range = this.findRange(document, i, name);
        const detail = line.substring(line.indexOf('('));
        symbols.push(new vscode.DocumentSymbol(
          name,
          `extern fn ${detail}`,
          vscode.SymbolKind.Function,
          range,
          range
        ));
        continue;
      }

      // extern name: type
      const externVarMatch = line.match(/^extern\s+([a-zA-Z_]\w*)\s*:/);
      if (externVarMatch) {
        const name = externVarMatch[1];
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          'extern',
          vscode.SymbolKind.Variable,
          range,
          range
        ));
        continue;
      }

      // tree(...) { or tree name {
      const treeMatch = line.match(/^tree\s*(?:\([^)]*\))?\s*\{?/);
      if (treeMatch) {
        const range = this.findRange(document, i, 'tree');
        symbols.push(new vscode.DocumentSymbol(
          'tree',
          line.substring(0, line.indexOf('{') + 1),
          vscode.SymbolKind.Module,
          range,
          range
        ));
        continue;
      }

      // object Type name {
      const objectMatch = line.match(/^object\s+([a-zA-Z_]\w+)\s+([a-zA-Z_]\w*)/);
      if (objectMatch) {
        const name = objectMatch[2];
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          `object ${objectMatch[1]}`,
          vscode.SymbolKind.Variable,
          range,
          range
        ));
        continue;
      }

      // vo create(...) / vo name
      const voMatch = line.match(/^vo\s+(?:create\s*\(|([a-zA-Z_]\w*))/);
      if (voMatch) {
        const name = voMatch[1] || 'vo';
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          'vo',
          vscode.SymbolKind.Variable,
          range,
          range
        ));
        continue;
      }

      // spend(target) { or spend name
      const spendMatch = line.match(/^spend\s*(?:\([^)]*\))?\s*\{?/);
      if (spendMatch) {
        const range = this.findRange(document, i, 'spend');
        symbols.push(new vscode.DocumentSymbol(
          'spend',
          line.substring(0, line.indexOf('{') + 1),
          vscode.SymbolKind.Function,
          range,
          range
        ));
        continue;
      }

      // Type name = ... / Type name; (field-like declarations inside classes/structs)
      const fieldMatch = line.match(/^([a-zA-Z_]\w*(?:<[^>]*>)?(?:\*?)?)\s+([a-zA-Z_]\w*)\s*(?:[=:,])/);
      if (fieldMatch && !['if','else','while','for','switch','case','return','break','continue','fn','struct','class','interface','enum','type','import','export','pub','static','const','extern','auto','vo','spend','call','task','async','prefix','tree','object'].includes(fieldMatch[1])) {
        const name = fieldMatch[2];
        const range = this.findRange(document, i, name);
        symbols.push(new vscode.DocumentSymbol(
          name,
          fieldMatch[1],
          vscode.SymbolKind.Field,
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
