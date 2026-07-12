import * as vscode from 'vscode';
import { KaulaCompletionProvider } from './completionProvider';
import { SORDiagnosticsProvider } from './sorDiagnosticsProvider';
import { TypeProvider } from './typeProvider';
import { KaulaFormatProvider } from './formatProvider';
import { DefinitionProvider } from './definitionProvider';
import { ReferenceProvider } from './referenceProvider';
import { SymbolProvider } from './symbolProvider';
import { RenameProvider } from './renameProvider';
import { BuildProvider } from './buildProvider';
import { CompilerDiagnosticsProvider } from './compilerDiagnosticsProvider';
import { SourceMapProvider, CDefinitionProvider } from './sourceMapProvider';
import { MappingView } from './mappingView';

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

  // 注册类型提示提供者
  const typeProvider = new TypeProvider();

  // 注册格式化提供者
  const formatProvider = new KaulaFormatProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(selector, formatProvider)
  );

  // 注册定义跳转提供者
  const definitionProvider = new DefinitionProvider(
    typeProvider.functions,
    typeProvider.variables
  );
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, definitionProvider)
  );

  // 注册引用查找提供者
  const referenceProvider = new ReferenceProvider();
  context.subscriptions.push(
    vscode.languages.registerReferenceProvider(selector, referenceProvider)
  );

  // 注册文件符号导航提供者
  const symbolProvider = new SymbolProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(selector, symbolProvider)
  );

  // 注册重命名提供者
  const renameProvider = new RenameProvider();
  context.subscriptions.push(
    vscode.languages.registerRenameProvider(selector, renameProvider)
  );

  // 注册编译器诊断提供者
  const compilerDiagnostics = new CompilerDiagnosticsProvider();
  context.subscriptions.push(compilerDiagnostics);

  // 注册构建提供者
  const buildProvider = new BuildProvider();
  context.subscriptions.push(buildProvider);

  // 注册 Source Map 提供者
  const sourceMapProvider = new SourceMapProvider();
  const cDefinitionProvider = new CDefinitionProvider(sourceMapProvider);
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: 'c', scheme: 'file' },
      cDefinitionProvider
    )
  );

  // 注册 C/KL 互跳命令
  context.subscriptions.push(
    vscode.commands.registerCommand('kaula.jumpToKL', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const doc = editor.document;
      if (doc.languageId !== 'c') {
        vscode.window.showWarningMessage('请先打开 C 文件');
        return;
      }
      const pos = editor.selection.active;
      sourceMapProvider.clearCache();
      const loc = sourceMapProvider.cToKL(doc.uri.fsPath, pos.line + 1);
      if (loc) {
        await vscode.window.showTextDocument(loc.uri, {
          selection: new vscode.Range(loc.range.start, loc.range.start)
        });
      } else {
        vscode.window.showWarningMessage('未找到对应的 Kaula 源码位置，请确保编译时使用了 --sourcemap 选项');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('kaula.jumpToC', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const doc = editor.document;
      if (doc.languageId !== 'kaula') {
        vscode.window.showWarningMessage('请先打开 Kaula 文件');
        return;
      }
      const pos = editor.selection.active;
      sourceMapProvider.clearCache();
      const loc = sourceMapProvider.klToC(doc.uri.fsPath, pos.line + 1);
      if (loc) {
        await vscode.window.showTextDocument(loc.uri, {
          selection: new vscode.Range(loc.range.start, loc.range.start)
        });
      } else {
        vscode.window.showWarningMessage('未找到对应的 C 代码位置，请确保编译时使用了 --sourcemap 选项');
      }
    })
  );

  // 注册映射视图
  const mappingView = new MappingView(sourceMapProvider);
  context.subscriptions.push(mappingView);

  // 编译成功后自动并排显示映射视图，并清空 source map 缓存
  buildProvider.setOnBuildSuccess(() => {
    sourceMapProvider.clearCache();
    mappingView.toggleMappingView();
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('kaula.showMapping', () => {
      sourceMapProvider.clearCache();
      mappingView.toggleMappingView();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('kaula.toggleSyncScroll', () => {
      const config = vscode.workspace.getConfiguration('kaula');
      const current = config.get<boolean>('mapping.syncScroll', true);
      config.update('mapping.syncScroll', !current, true);
      mappingView.setSyncScroll(!current);
      vscode.window.showInformationMessage(`同步滚动已${!current ? '开启' : '关闭'}`);
    })
  );

  // 注册构建/运行命令
  context.subscriptions.push(
    vscode.commands.registerCommand('kaula.build', () => buildProvider.build())
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('kaula.run', () => buildProvider.run())
  );

  // 注册 Hover 提供者（SOR + 类型）
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, {
      provideHover: (document, position) => {
        const typeHover = typeProvider.provideHover(document, position);
        if (typeHover) { return typeHover; }
        return sorDiagnostics.provideHover(document, position);
      }
    })
  );

  // 注册 Signature Help 提供者
  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider(selector, {
      provideSignatureHelp: (document, position) => {
        return typeProvider.provideSignatureHelp(document, position);
      }
    }, '(', ',')
  );

  // 分析文档并更新所有提供者
  const analyzeDocument = (doc: vscode.TextDocument) => {
    if (doc.languageId !== 'kaula') { return; }
    sorDiagnostics.updateDiagnostics(doc);
    typeProvider.analyzeDocument(doc);
    definitionProvider.update(typeProvider.functions, typeProvider.variables);
    compilerDiagnostics.updateDiagnostics(doc);
  };

  // 对已打开的文件运行诊断和类型分析
  vscode.workspace.textDocuments.forEach(analyzeDocument);

  // 监听文档变更
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => analyzeDocument(e.document))
  );

  // 监听文档打开
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(analyzeDocument)
  );

  // 监听文档关闭（清理诊断）
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(_doc => {})
  );
}

export function deactivate() {}
