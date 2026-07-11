import * as vscode from 'vscode';
import { stdlibModules, moduleNames, kaulaKeywords, builtinTypes, stdlibTypeAliases, builtinConstants } from './stdlibData';

// vo 模块成员（parser 中 vo.XXX 作为特殊成员访问）
const voMembers = ['create', 'destroy', 'data_load', 'code_load', 'associate', 'access', 'get_cache_max'];
// prefix 模块成员（parser 中 prefix.XXX 作为特殊成员访问）
const prefixMembers = ['system_create', 'system_destroy', 'enter', 'leave', 'set_data', 'get_data', 'find', 'system_get'];

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
    const importStdMatch = textBefore.match(/import\s+std\.(\w*)$/);
    if (importStdMatch) {
      return this.provideModuleCompletions();
    }

    // 2. import XXX → 补全 std 和其他模块前缀
    const importMatch = textBefore.match(/import\s+(\w*)$/);
    if (importMatch) {
      return this.provideImportRootCompletions();
    }

    // 3. vo.XXX → 补全 vo 模块函数
    const voMatch = textBefore.match(/\bvo\.(\w*)$/);
    if (voMatch) {
      return this.provideVoMemberCompletions();
    }

    // 4. prefix.XXX → 补全 prefix 模块函数
    const prefixMatch = textBefore.match(/\bprefix\.(\w*)$/);
    if (prefixMatch) {
      return this.providePrefixMemberCompletions();
    }

    // 5. std.XXX.YYY → 补全模块函数
    const moduleFuncMatch = textBefore.match(/std\.(\w+)\.(\w*)$/);
    if (moduleFuncMatch) {
      const moduleName = moduleFuncMatch[1];
      return this.provideModuleFunctionCompletions(moduleName);
    }

    // 6. std.XXX → 补全模块名
    const stdMatch = textBefore.match(/std\.(\w*)$/);
    if (stdMatch) {
      return this.provideModuleCompletions();
    }

    // 7. SOR 箭头右侧：yeide source -> / release source -> / extract ... ->
    // 在 -> 后面应该补全标识符（变量名），这里提供常见变量名建议
    const sorArrowMatch = textBefore.match(/\b(yeide|release|extract)\b.*->\s*(\w*)$/);
    if (sorArrowMatch) {
      return this.provideSORTargetCompletions(document, sorArrowMatch[1]);
    }

    // 8. release source -> [ → 补全持有者变量名
    const releaseHolderMatch = textBefore.match(/release\b.*->\s*\[([^\]]]*)$/);
    if (releaseHolderMatch) {
      return this.provideSORTargetCompletions(document, 'release');
    }

    // 9. 普通位置 → 关键字 + 类型 + 常量 + println
    return this.provideGeneralCompletions();
  }

  // import 语句根级别补全：std / 本地模块
  private provideImportRootCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    const stdItem = new vscode.CompletionItem('std', vscode.CompletionItemKind.Module);
    stdItem.detail = '标准库根模块';
    stdItem.insertText = new vscode.SnippetString('std.${1|' + moduleNames.join(',') + '|}');
    items.push(stdItem);

    return items;
  }

  private provideModuleCompletions(): vscode.CompletionItem[] {
    return moduleNames.map(name => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
      item.detail = `std.${name}`;
      const mod = stdlibModules[name];
      if (mod && mod.header) {
        item.documentation = `来自 ${mod.header}`;
      }
      return item;
    });
  }

  private provideModuleFunctionCompletions(moduleName: string): vscode.CompletionItem[] {
    const mod = stdlibModules[moduleName];
    if (!mod) { return []; }

    const items: vscode.CompletionItem[] = [];

    // 函数补全
    const functions = mod.functions as Record<string, { args: string[]; return?: string; varargs?: boolean }>;
    for (const [funcName, sig] of Object.entries(functions)) {
      const item = new vscode.CompletionItem(funcName, vscode.CompletionItemKind.Function);
      const argsStr = sig.args.join(', ');
      const retStr = sig.return ? ` -> ${sig.return}` : '';
      item.detail = `${funcName}(${argsStr})${retStr}`;
      if (mod.header) {
        item.documentation = new vscode.MarkdownString(`**${mod.header}**\n\n${funcName}(${argsStr})${retStr}`);
      }
      // 自动插入函数调用括号
      item.insertText = new vscode.SnippetString(`${funcName}($1)$0`);
      items.push(item);
    }

    // 类型补全
    if (mod.types) {
      for (const [typeName, desc] of Object.entries(mod.types)) {
        const item = new vscode.CompletionItem(typeName, vscode.CompletionItemKind.Struct);
        item.detail = typeof desc === 'string' ? desc : `${moduleName}.${typeName}`;
        items.push(item);
      }
    }

    return items;
  }

  // vo 模块成员补全（vo.create 等特殊访问）
  private provideVoMemberCompletions(): vscode.CompletionItem[] {
    const mod = stdlibModules['vo'];
    if (!mod) { return []; }
    return this.buildMemberItems(mod.functions, voMembers, mod.header);
  }

  // prefix 模块成员补全（prefix.enter 等特殊访问）
  private providePrefixMemberCompletions(): vscode.CompletionItem[] {
    const mod = stdlibModules['prefix'];
    if (!mod) { return []; }
    return this.buildMemberItems(mod.functions, prefixMembers, mod.header);
  }

  private buildMemberItems(
    functions: Record<string, { args: string[]; return?: string; varargs?: boolean }>,
    members: string[],
    header: string
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    for (const name of members) {
      const sig = functions[name];
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      if (sig) {
        const argsStr = sig.args.join(', ');
        const retStr = sig.return ? ` -> ${sig.return}` : '';
        item.detail = `${name}(${argsStr})${retStr}`;
      } else {
        item.detail = name;
      }
      if (header) { item.documentation = header; }
      item.insertText = new vscode.SnippetString(`${name}($1)$0`);
      items.push(item);
    }
    return items;
  }

  // SOR 目标补全：建议当前作用域中已声明的变量
  private provideSORTargetCompletions(document: vscode.TextDocument, kind: string): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const seen = new Set<string>();

    // 扫描当前文件中已声明的变量名
    const text = document.getText();
    // 变量声明模式：Type name = ... 或 auto name = ...
    const varPattern = /\b(?:int|float|double|bool|char|string|void|i8|i16|i32|i64|u8|u16|u32|u64|f32|f64|KString|File|bool_t|char_t|ptr|auto)\s+\*?\s*([a-zA-Z_]\w*)\s*(?:=|;|$)/g;
    let m: RegExpExecArray | null;
    while ((m = varPattern.exec(text)) !== null) {
      const name = m[1];
      if (!seen.has(name)) {
        seen.add(name);
        items.push(new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable));
      }
    }

    // 添加 kind 说明
    const hint = new vscode.CompletionItem(`// ${kind} 目标`, vscode.CompletionItemKind.Text);
    items.unshift(hint);

    return items;
  }

  private provideGeneralCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // 关键字
    for (const kw of kaulaKeywords) {
      items.push(new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword));
    }

    // 词法分析器内置类型关键字
    for (const t of builtinTypes) {
      items.push(new vscode.CompletionItem(t, vscode.CompletionItemKind.Struct));
    }

    // 标准库类型别名
    for (const t of stdlibTypeAliases) {
      const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.Class);
      item.detail = 'std.base 类型别名';
      items.push(item);
    }

    // 常量
    for (const c of builtinConstants) {
      items.push(new vscode.CompletionItem(c, vscode.CompletionItemKind.Constant));
    }

    // 内置函数
    const builtins: { name: string; detail: string; snippet: string }[] = [
      { name: 'println', detail: 'println(...) → void', snippet: 'println($1)$0' },
      { name: 'print', detail: 'print(...) → void', snippet: 'print($1)$0' },
      { name: 'print_char', detail: 'print_char(char) → void', snippet: 'print_char($1)$0' },
      { name: 'print_int', detail: 'print_int(i64) → void', snippet: 'print_int($1)$0' },
      { name: 'print_float', detail: 'print_float(f64) → void', snippet: 'print_float($1)$0' },
      { name: 'print_bool', detail: 'print_bool(bool) → void', snippet: 'print_bool($1)$0' },
      { name: 'read_char', detail: 'read_char() → char', snippet: 'read_char()$0' },
      { name: 'read_int', detail: 'read_int() → i64', snippet: 'read_int()$0' },
      { name: 'read_float', detail: 'read_float() → f64', snippet: 'read_float()$0' },
      { name: 'read_bool', detail: 'read_bool() → bool', snippet: 'read_bool()$0' },
      { name: 'read_line', detail: 'read_line() → char*', snippet: 'read_line()$0' },
      { name: 'read_string', detail: 'read_string(size_t) → char*', snippet: 'read_string($1)$0' },
      { name: 'sizeof', detail: 'sizeof(Type) → size_t', snippet: 'sizeof($1)$0' },
      { name: 'alignof', detail: 'alignof(Type) → size_t', snippet: 'alignof($1)$0' },
      { name: 'offsetof', detail: 'offsetof(Type, field) → size_t', snippet: 'offsetof($1, $2)$0' },
      { name: 'comptime', detail: 'comptime(expr) → compile-time value', snippet: 'comptime($1)$0' },
      { name: 'type_name', detail: 'type_name(expr) → string', snippet: 'type_name($1)$0' },
      { name: 'field_count', detail: 'field_count(Type) → size_t', snippet: 'field_count($1)$0' },
      { name: 'field_name', detail: 'field_name(Type, index) → string', snippet: 'field_name($1, $2)$0' },
      { name: 'field_type', detail: 'field_type(Type, index) → string', snippet: 'field_type($1, $2)$0' },
      { name: 'type_kind', detail: 'type_kind(Type) → int', snippet: 'type_kind($1)$0' },
    ];
    for (const b of builtins) {
      const item = new vscode.CompletionItem(b.name, vscode.CompletionItemKind.Function);
      item.detail = b.detail;
      item.insertText = new vscode.SnippetString(b.snippet);
      items.push(item);
    }

    return items;
  }
}
