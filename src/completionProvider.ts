import * as vscode from 'vscode';
import { stdlibModules, moduleNames, kaulaKeywords, builtinTypes } from './stdlibData';

export class KaulaCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] | undefined {
    const lineText = document.lineAt(position).text;
    const textBefore = lineText.substring(0, position.character);

    // 1. import std.XXX → 补全模块名
    const importMatch = textBefore.match(/import\s+std\.(\w*)$/);
    if (importMatch) {
      return this.provideModuleCompletions();
    }

    // 2. std.XXX.YYY → 补全模块函数
    const moduleFuncMatch = textBefore.match(/std\.(\w+)\.(\w*)$/);
    if (moduleFuncMatch) {
      const moduleName = moduleFuncMatch[1];
      return this.provideModuleFunctionCompletions(moduleName);
    }

    // 3. std.XXX → 补全模块名
    const stdMatch = textBefore.match(/std\.(\w*)$/);
    if (stdMatch) {
      return this.provideModuleCompletions();
    }

    // 4. 普通位置 → 关键字 + 类型 + println
    return this.provideGeneralCompletions();
  }

  private provideModuleCompletions(): vscode.CompletionItem[] {
    return moduleNames.map(name => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
      item.detail = `std.${name}`;
      return item;
    });
  }

  private provideModuleFunctionCompletions(moduleName: string): vscode.CompletionItem[] {
    const mod = stdlibModules[moduleName];
    if (!mod) { return []; }

    const items: vscode.CompletionItem[] = [];

    // 函数补全
    for (const [funcName, sig] of Object.entries(mod.functions)) {
      const item = new vscode.CompletionItem(funcName, vscode.CompletionItemKind.Function);
      const argsStr = sig.args.join(', ');
      const retStr = sig.return ? ` → ${sig.return}` : '';
      item.detail = `${funcName}(${argsStr})${retStr}`;
      item.documentation = mod.header;
      items.push(item);
    }

    // 类型补全
    if (mod.types) {
      for (const [typeName, desc] of Object.entries(mod.types)) {
        const item = new vscode.CompletionItem(typeName, vscode.CompletionItemKind.Struct);
        item.detail = desc;
        items.push(item);
      }
    }

    return items;
  }

  private provideGeneralCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // 关键字
    for (const kw of kaulaKeywords) {
      items.push(new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword));
    }

    // 内置类型
    for (const t of builtinTypes) {
      items.push(new vscode.CompletionItem(t, vscode.CompletionItemKind.Struct));
    }

    // println
    const printlnItem = new vscode.CompletionItem('println', vscode.CompletionItemKind.Function);
    printlnItem.detail = 'println(...) → void';
    items.push(printlnItem);

    return items;
  }
}
