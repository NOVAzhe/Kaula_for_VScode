"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KaulaCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const stdlibData_1 = require("./stdlibData");
class KaulaCompletionProvider {
    provideCompletionItems(document, position, _token, _context) {
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
    provideModuleCompletions() {
        return stdlibData_1.moduleNames.map(name => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
            item.detail = `std.${name}`;
            return item;
        });
    }
    provideModuleFunctionCompletions(moduleName) {
        const mod = stdlibData_1.stdlibModules[moduleName];
        if (!mod) {
            return [];
        }
        const items = [];
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
    provideGeneralCompletions() {
        const items = [];
        // 关键字
        for (const kw of stdlibData_1.kaulaKeywords) {
            items.push(new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword));
        }
        // 内置类型
        for (const t of stdlibData_1.builtinTypes) {
            items.push(new vscode.CompletionItem(t, vscode.CompletionItemKind.Struct));
        }
        // println
        const printlnItem = new vscode.CompletionItem('println', vscode.CompletionItemKind.Function);
        printlnItem.detail = 'println(...) → void';
        items.push(printlnItem);
        return items;
    }
}
exports.KaulaCompletionProvider = KaulaCompletionProvider;
//# sourceMappingURL=completionProvider.js.map