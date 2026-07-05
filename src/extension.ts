import * as vscode from 'vscode';
import { KaulaCompletionProvider } from './completionProvider';
import { SORDiagnosticsProvider } from './sorDiagnosticsProvider';

export function activate(context: vscode.ExtensionContext) {
  const selector: vscode.DocumentSelector = { language: 'kaula', scheme: 'file' };

  // 注册补全提供者
  const completionProvider = new KaulaCompletionProvider();
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(selector, completionProvider, '.')
  );

  // 注册 SOR DAG 诊断
  const sorDiagnostics = new SORDiagnosticsProvider();
  context.subscriptions.push(sorDiagnostics);

  // 注册 Hover 提供者
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, {
      provideHover: (document, position) => sorDiagnostics.provideHover(document, position)
    })
  );

  // 对已打开的文件运行诊断
  vscode.workspace.textDocuments.forEach(doc => {
    if (doc.languageId === 'kaula') {
      sorDiagnostics.updateDiagnostics(doc);
    }
  });

  // 监听文档变更
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.languageId === 'kaula') {
        sorDiagnostics.updateDiagnostics(e.document);
      }
    })
  );

  // 监听文档打开
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (doc.languageId === 'kaula') {
        sorDiagnostics.updateDiagnostics(doc);
      }
    })
  );

  // 监听文档关闭（清理诊断）
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(_doc => {
      // 诊断集合会自动清理
    })
  );
}

export function deactivate() {}
