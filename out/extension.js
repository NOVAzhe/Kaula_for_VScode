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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const completionProvider_1 = require("./completionProvider");
const sorDiagnosticsProvider_1 = require("./sorDiagnosticsProvider");
function activate(context) {
    const selector = { language: 'kaula', scheme: 'file' };
    // 注册补全提供者
    const completionProvider = new completionProvider_1.KaulaCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, completionProvider, '.'));
    // 注册 SOR DAG 诊断
    const sorDiagnostics = new sorDiagnosticsProvider_1.SORDiagnosticsProvider();
    context.subscriptions.push(sorDiagnostics);
    // 注册 Hover 提供者
    context.subscriptions.push(vscode.languages.registerHoverProvider(selector, {
        provideHover: (document, position) => sorDiagnostics.provideHover(document, position)
    }));
    // 对已打开的文件运行诊断
    vscode.workspace.textDocuments.forEach(doc => {
        if (doc.languageId === 'kaula') {
            sorDiagnostics.updateDiagnostics(doc);
        }
    });
    // 监听文档变更
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.languageId === 'kaula') {
            sorDiagnostics.updateDiagnostics(e.document);
        }
    }));
    // 监听文档打开
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        if (doc.languageId === 'kaula') {
            sorDiagnostics.updateDiagnostics(doc);
        }
    }));
    // 监听文档关闭（清理诊断）
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(_doc => {
        // 诊断集合会自动清理
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map