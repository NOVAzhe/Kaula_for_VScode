import * as vscode from 'vscode';
import { stdlibModules, builtinTypes, stdlibTypeAliases } from './stdlibData';

// ============================================================================
// Kaula 类型提示提供者
// 提供 Hover 类型显示和 Signature Help
// ============================================================================

export interface VarInfo {
  name: string;
  type: string;
  line: number;
  isAuto: boolean;
}

export interface FuncInfo {
  name: string;
  params: string[];
  paramTypes: string[];
  returnType: string;
  line: number;
  isStdlib: boolean;
  stdlibModule?: string;
}

export class TypeProvider {
  variables: Map<string, VarInfo[]> = new Map();
  functions: Map<string, FuncInfo> = new Map();

  // 解析文档，提取变量和函数信息
  analyzeDocument(document: vscode.TextDocument): void {
    this.variables.clear();
    this.functions.clear();

    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // 跳过注释
      if (line.startsWith('//') || line.startsWith('#') || line.startsWith('#[') && line.endsWith(']')) {
        continue;
      }

      // 函数声明：fn name(params) ReturnType {
      const funcMatch = line.match(/^fn\s+([a-zA-Z_]\w*)\s*\(/);
      if (funcMatch) {
        const funcInfo = this.parseFunctionDecl(lines, i);
        if (funcInfo) {
          this.functions.set(funcInfo.name, funcInfo);
        }
        continue;
      }

      // 变量声明：Type name = ...  或  Type name;
      this.parseVariableDecl(line, i);

      // auto 声明：auto name = ...
      const autoMatch = line.match(/^auto\s+([a-zA-Z_]\w*)\s*=/);
      if (autoMatch) {
        const varName = autoMatch[1];
        const inferredType = this.inferAutoType(line, i);
        this.addVariable(varName, inferredType || 'auto (inferred)', i, true);
      }
    }

    // 注册标准库函数
    this.registerStdlibFunctions();
  }

  // 解析函数声明
  private parseFunctionDecl(lines: string[], startLine: number): FuncInfo | null {
    const line = lines[startLine];
    const nameMatch = line.match(/fn\s+([a-zA-Z_]\w*)\s*\(/);
    if (!nameMatch) { return null; }

    const name = nameMatch[1];
    const params: string[] = [];
    const paramTypes: string[] = [];

    // 尝试在单行中提取参数
    const fullMatch = line.match(/fn\s+\w+\s*\(([^)]*)\)/);
    if (fullMatch) {
      const paramStr = fullMatch[1];
      this.parseParams(paramStr, params, paramTypes);
    } else {
      // 多行参数
      let paramStr = '';
      let depth = 0;
      let foundOpen = false;
      for (let i = startLine; i < lines.length && i < startLine + 20; i++) {
        const l = lines[i];
        for (const ch of l) {
          if (ch === '(') { depth++; foundOpen = true; }
          else if (ch === ')') {
            depth--;
            if (depth === 0 && foundOpen) { break; }
          }
          if (foundOpen && depth > 0) {
            paramStr += ch;
          }
        }
        if (foundOpen && depth === 0) { break; }
      }
      this.parseParams(paramStr, params, paramTypes);
    }

    // 提取返回类型
    let returnType = 'void';
    const retMatch = line.match(/\)\s*([a-zA-Z_*][\w*]*)\s*\{?\s*$/);
    if (retMatch) {
      returnType = retMatch[1].trim();
    } else {
      // 检查多行
      for (let i = startLine; i < startLine + 5 && i < lines.length; i++) {
        const l = lines[i];
        const multiRet = l.match(/^\s*([a-zA-Z_*][\w*]*)\s*\{/);
        if (multiRet) {
          returnType = multiRet[1].trim();
          break;
        }
      }
    }

    return {
      name,
      params,
      paramTypes,
      returnType,
      line: startLine,
      isStdlib: false
    };
  }

  // 解析参数字符串
  private parseParams(paramStr: string, params: string[], paramTypes: string[]): void {
    if (!paramStr.trim()) { return; }

    const parts = paramStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) { continue; }

      // 跳过 task(...) / async(...) 参数
      if (trimmed.startsWith('task(') || trimmed.startsWith('async(')) {
        continue;
      }

      // Type name  或  Type* name  或  *Type name
      const paramMatch = trimmed.match(/^([*]?[a-zA-Z_]\w*[*]?)\s+([a-zA-Z_]\w*)$/);
      if (paramMatch) {
        paramTypes.push(paramMatch[1]);
        params.push(paramMatch[2]);
      } else {
        // 只有名字（无类型）
        const nameMatch = trimmed.match(/^([a-zA-Z_]\w*)$/);
        if (nameMatch) {
          paramTypes.push('');
          params.push(nameMatch[1]);
        }
      }
    }
  }

  // 解析变量声明
  private parseVariableDecl(line: string, lineNum: number): void {
    // Type name = ...
    const typeKeywords = [...builtinTypes, ...stdlibTypeAliases];
    for (const t of typeKeywords) {
      const re = new RegExp(`^${t}\\s+\\*?\\s*([a-zA-Z_]\\w*)\\s*(?:=|;)`);
      const m = line.match(re);
      if (m) {
        const star = line.includes('*' + m[1]) || line.includes(t + '*') ? '*' : '';
        this.addVariable(m[1], t + star, lineNum, false);
        break;
      }
    }

    // 自定义类型变量：Ident name = / Ident name;
    const customTypeMatch = line.match(/^([A-Z][a-zA-Z0-9_]*)\s+([a-zA-Z_]\w*)\s*(?:=|;)/);
    if (customTypeMatch) {
      this.addVariable(customTypeMatch[2], customTypeMatch[1], lineNum, false);
    }
  }

  // 推断 auto 类型
  private inferAutoType(line: string, _lineNum: number): string | null {
    // std.io.read_int() -> i64
    const stdCallMatch = line.match(/=\s*std\.(\w+)\.(\w+)\s*\(/);
    if (stdCallMatch) {
      const modName = stdCallMatch[1];
      const funcName = stdCallMatch[2];
      const mod = stdlibModules[modName];
      if (mod && mod.functions[funcName]) {
        return mod.functions[funcName].return || 'void';
      }
    }

    // 字符串字面量 -> string
    if (line.match(/=\s*"[^"]*"\s*;?$/)) {
      return 'string';
    }
    // 整数 -> int
    if (line.match(/=\s*-?\d+\s*;?$/)) {
      return 'int';
    }
    // 浮点数 -> float
    if (line.match(/=\s*-?\d+\.\d+\s*;?$/)) {
      return 'float';
    }
    // true/false -> bool
    if (line.match(/=\s*(true|false)\s*;?$/)) {
      return 'bool';
    }

    return null;
  }

  private addVariable(name: string, type: string, line: number, isAuto: boolean): void {
    if (!this.variables.has(name)) {
      this.variables.set(name, []);
    }
    this.variables.get(name)!.push({ name, type, line, isAuto });
  }

  // 注册标准库函数
  private registerStdlibFunctions(): void {
    for (const [modName, mod] of Object.entries(stdlibModules)) {
      for (const [funcName, sig] of Object.entries(mod.functions)) {
        // 全名如 std.io.println
        const fullName = `std.${modName}.${funcName}`;
        const info: FuncInfo = {
          name: fullName,
          params: sig.args.map((a, i) => `arg${i}`),
          paramTypes: sig.args.map(a => a.replace(/^const\s+/, '')),
          returnType: sig.return || 'void',
          line: -1,
          isStdlib: true,
          stdlibModule: modName
        };
        this.functions.set(fullName, info);

        // 也注册短名（用于普通调用匹配）
        if (!this.functions.has(funcName)) {
          this.functions.set(funcName, info);
        }
      }
    }
  }

  // Hover：获取标识符的类型信息
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) { return null; }

    const word = document.getText(wordRange);
    const lineText = document.lineAt(position).text;
    const textBefore = lineText.substring(0, wordRange.start.character);

    // 1. 检查是否是 std.module.func 调用中的函数名
    const stdFuncMatch = textBefore.match(/std\.(\w+)\.$/);
    if (stdFuncMatch) {
      const modName = stdFuncMatch[1];
      const mod = stdlibModules[modName];
      if (mod && mod.functions[word]) {
        return this.buildStdlibFuncHover(modName, word, mod.header);
      }
      if (mod && mod.types && mod.types[word]) {
        return this.buildStdlibTypeHover(modName, word, mod.types[word]);
      }
    }

    // 2. 检查是否是函数调用
    const callMatch = textBefore.match(/\b([a-zA-Z_]\w*)\s*\(\s*$/);
    if (callMatch) {
      const funcName = callMatch[1];
      const funcInfo = this.functions.get(funcName);
      if (funcInfo) {
        return this.buildFunctionHover(funcInfo);
      }
    }

    // 3. 检查是否是变量引用
    const varInfos = this.variables.get(word);
    if (varInfos && varInfos.length > 0) {
      // 找到最近的声明
      const varInfo = varInfos[varInfos.length - 1];
      return this.buildVariableHover(varInfo);
    }

    // 4. 检查是否是内置类型
    if (builtinTypes.includes(word) || stdlibTypeAliases.includes(word)) {
      return this.buildBuiltinTypeHover(word);
    }

    // 5. 检查是否是函数声明的函数名
    const funcInfo = this.functions.get(word);
    if (funcInfo && !funcInfo.isStdlib) {
      return this.buildFunctionHover(funcInfo);
    }

    return null;
  }

  private buildStdlibFuncHover(modName: string, funcName: string, header: string): vscode.Hover {
    const mod = stdlibModules[modName];
    const sig = mod.functions[funcName];
    const argsStr = sig.args.join(', ');
    const retStr = sig.return ? ` → ${sig.return}` : '';

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**std.${modName}.${funcName}**\n\n`);
    md.appendCodeblock(`${funcName}(${argsStr})${retStr}`, 'kaula');
    if (header) {
      md.appendMarkdown(`\n*来自 ${header}*`);
    }
    return new vscode.Hover(md);
  }

  private buildStdlibTypeHover(modName: string, typeName: string, desc: string): vscode.Hover {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**std.${modName}.${typeName}**\n\n`);
    if (desc && desc !== 'struct' && !desc.startsWith('enum')) {
      md.appendCodeblock(desc, 'kaula');
    } else if (desc.startsWith('enum')) {
      md.appendCodeblock(desc, 'kaula');
    } else {
      md.appendMarkdown(`\`${typeName}\` — ${desc}\n`);
    }
    return new vscode.Hover(md);
  }

  private buildFunctionHover(func: FuncInfo): vscode.Hover {
    const md = new vscode.MarkdownString();
    if (func.isStdlib) {
      md.appendMarkdown(`**${func.name}**\n\n`);
    } else {
      md.appendMarkdown(`**fn ${func.name}**\n\n`);
    }

    const paramsStr = func.params.map((p, i) => {
      const t = func.paramTypes[i] || 'auto';
      return `${t} ${p}`;
    }).join(', ');

    md.appendCodeblock(`fn ${func.name}(${paramsStr}) ${func.returnType}`, 'kaula');

    if (func.isStdlib && func.stdlibModule) {
      md.appendMarkdown(`\n*标准库函数*`);
    } else {
      md.appendMarkdown(`\n*第 ${func.line + 1} 行声明*`);
    }

    return new vscode.Hover(md);
  }

  private buildVariableHover(vr: VarInfo): vscode.Hover {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${vr.name}**\n\n`);
    md.appendCodeblock(`${vr.type} ${vr.name}`, 'kaula');
    md.appendMarkdown(`\n*第 ${vr.line + 1} 行声明*`);
    if (vr.isAuto) {
      md.appendMarkdown(`\n*(auto 推断)*`);
    }
    return new vscode.Hover(md);
  }

  private buildBuiltinTypeHover(typeName: string): vscode.Hover {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${typeName}**\n\n`);

    const typeDescriptions: Record<string, string> = {
      'int': '有符号整数（默认整型）',
      'float': '单精度浮点数',
      'double': '双精度浮点数',
      'bool': '布尔值 (true/false)',
      'char': '字符',
      'string': '字符串',
      'void': '无类型',
      'i8': '8位有符号整数 (-128 ~ 127)',
      'i16': '16位有符号整数',
      'i32': '32位有符号整数',
      'i64': '64位有符号整数',
      'u8': '8位无符号整数 (0 ~ 255)',
      'u16': '16位无符号整数',
      'u32': '32位无符号整数',
      'u64': '64位无符号整数',
      'f32': '32位浮点数 (float)',
      'f64': '64位浮点数 (double)',
    };

    const desc = typeDescriptions[typeName];
    if (desc) {
      md.appendMarkdown(`${desc}\n`);
    }

    md.appendMarkdown(`\n*内置类型*`);
    return new vscode.Hover(md);
  }

  // Signature Help：函数签名提示
  provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.SignatureHelp | null {
    const lineText = document.lineAt(position).text;
    const textBefore = lineText.substring(0, position.character);

    // 找到函数调用的开始位置：函数名(
    const callMatch = textBefore.match(/([a-zA-Z_]\w*)\s*\(([^)]*)$/);
    if (!callMatch) { return null; }

    const funcName = callMatch[1];
    const argsSoFar = callMatch[2];
    const paramIndex = argsSoFar ? argsSoFar.split(',').length - 1 : 0;

    // 标准库函数：std.module.func(
    const stdCallMatch = textBefore.match(/std\.(\w+)\.(\w+)\s*\(([^)]*)$/);
    if (stdCallMatch) {
      const modName = stdCallMatch[1];
      const stdFuncName = stdCallMatch[2];
      const mod = stdlibModules[modName];
      if (mod && mod.functions[stdFuncName]) {
        return this.buildStdlibSignatureHelp(modName, stdFuncName, paramIndex);
      }
    }

    // 本地函数
    const funcInfo = this.functions.get(funcName);
    if (funcInfo) {
      return this.buildLocalSignatureHelp(funcInfo, paramIndex);
    }

    // println 内置
    if (funcName === 'println') {
      const help = new vscode.SignatureHelp();
      const sig = new vscode.SignatureInformation('println(format: string, ...args) → void', 'println');
      sig.parameters = [
        new vscode.ParameterInformation('format: string', '格式化字符串')
      ];
      help.signatures = [sig];
      help.activeParameter = Math.min(paramIndex, sig.parameters.length - 1);
      help.activeSignature = 0;
      return help;
    }

    return null;
  }

  private buildStdlibSignatureHelp(modName: string, funcName: string, activeParam: number): vscode.SignatureHelp {
    const mod = stdlibModules[modName];
    const sig = mod.functions[funcName];

    const help = new vscode.SignatureHelp();
    const argsStr = sig.args.join(', ');
    const retStr = sig.return ? ` → ${sig.return}` : '';
    const label = `std.${modName}.${funcName}(${argsStr})${retStr}`;

    const sigInfo = new vscode.SignatureInformation(label, `标准库函数 - ${mod.header || 'std.' + modName}`);
    sigInfo.parameters = sig.args.map((arg, i) => {
      return new vscode.ParameterInformation(arg, `参数 ${i + 1}`);
    });

    help.signatures = [sigInfo];
    help.activeParameter = Math.max(0, Math.min(activeParam, sigInfo.parameters.length - 1));
    help.activeSignature = 0;
    return help;
  }

  private buildLocalSignatureHelp(func: FuncInfo, activeParam: number): vscode.SignatureHelp {
    const help = new vscode.SignatureHelp();

    const paramsStr = func.params.map((p, i) => {
      const t = func.paramTypes[i] || 'auto';
      return `${t} ${p}`;
    }).join(', ');

    const label = `fn ${func.name}(${paramsStr}) → ${func.returnType}`;
    const sigInfo = new vscode.SignatureInformation(label, `函数声明 (第 ${func.line + 1} 行)`);

    sigInfo.parameters = func.params.map((p, i) => {
      const t = func.paramTypes[i] || 'auto';
      return new vscode.ParameterInformation(`${t} ${p}`, `参数 ${i + 1}: ${p}`);
    });

    help.signatures = [sigInfo];
    help.activeParameter = Math.max(0, Math.min(activeParam, sigInfo.parameters.length - 1));
    help.activeSignature = 0;
    return help;
  }
}
