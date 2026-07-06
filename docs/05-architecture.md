# 05 — 架构与开发

本文档介绍 Kaula IDE 插件的源码结构、扩展点和开发流程。

## 源码结构

```
kaula_for_vscode/
├── syntaxes/                              # TextMate 语法文件
│   ├── kaula.tmLanguage.json             # 核心语言语法
│   └── kaula-sor.tmLanguage.json         # SOR 扩展语法
├── snippets/
│   └── kaula.json                        # 代码片段
├── src/                                  # TypeScript 源代码
│   ├── extension.ts                      # 插件入口：注册所有提供者
│   ├── completionProvider.ts             # 智能补全
│   ├── typeProvider.ts                   # 类型推断和 Hover/签名帮助
│   ├── definitionProvider.ts             # 定义跳转
│   ├── referenceProvider.ts              # 引用查找
│   ├── symbolProvider.ts                # 文件符号导航
│   ├── renameProvider.ts                # 重命名符号
│   ├── formatProvider.ts                 # 代码格式化
│   ├── buildProvider.ts                 # 编译/运行集成
│   ├── sorDiagnosticsProvider.ts         # SOR DAG 诊断
│   ├── compilerDiagnosticsProvider.ts    # 编译器静态分析诊断
│   ├── sourceMapProvider.ts              # Source Map 加载和查找
│   ├── mappingView.ts                   # 分屏映射视图
│   └── stdlibData.ts                     # 标准库元数据
├── out/                                  # 编译输出
├── docs/                                # 文档
├── language-configuration.json          # 语言配置（括号、注释等）
├── package.json                         # 插件清单
└── tsconfig.json                         # TypeScript 配置
```

## 模块依赖关系

```
extension.ts
  ├── completionProvider.ts ──┐
  ├── typeProvider.ts ────────┤
  │   └── stdlibData.ts       │
  ├── definitionProvider.ts ──┤ (使用 typeProvider 的函数/变量表)
  ├── referenceProvider.ts    │
  ├── symbolProvider.ts       │
  ├── renameProvider.ts       │
  ├── formatProvider.ts       │
  ├── buildProvider.ts        │
  ├── sorDiagnosticsProvider.ts
  ├── compilerDiagnosticsProvider.ts
  ├── sourceMapProvider.ts ───┐
  └── mappingView.ts ─────────┘ (使用 sourceMapProvider)
```

## 入口点

### `extension.ts`

`activate()` 函数完成以下工作：

1. 创建所有提供者实例
2. 注册 VSCode 语言服务提供者
3. 注册命令
4. 设置文档变更监听器
5. 对已打开的文档运行初始分析

关键代码：
```typescript
const selector: vscode.DocumentSelector = { language: 'kaula', scheme: 'file' };

// 注册各种提供者
vscode.languages.registerCompletionItemProvider(selector, ...);
vscode.languages.registerDefinitionProvider(selector, ...);
// ...
```

## 核心提供者说明

### `typeProvider.ts`
- 解析 KL 源码提取变量声明和函数签名
- 维护 `variables: Map<string, VarInfo[]>` 和 `functions: Map<string, FuncInfo>`
- 支持 `auto` 推断（字面量和标准库函数返回值）
- 提供 Hover 和 Signature Help
- 暴露公共字段供 definitionProvider 使用

### `sourceMapProvider.ts`
- 加载和缓存 `.map.json` 文件
- `cToKL(cFile, cLine)` → KL 位置
- `klToC(klFile, klLine)` → C 位置
- 自动查找多个可能的 map 文件位置

### `mappingView.ts`
- 协调两个编辑器的显示和交互
- 三种装饰类型：
  - `klDecorationType` / `cDecorationType`：蓝色（映射行标记）
  - `activeLineDecorationType`：橙色（当前行）
- 监听选择变化触发同步滚动
- 监听保存事件触发 map 重新加载

## 开发流程

### 环境要求
- Node.js 18+
- VS Code 1.75+
- TypeScript 5+

### 构建与调试

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 监听模式（开发时）
npm run watch
```

在 VSCode 中按 `F5` 启动 Extension Development Host 进行调试。

### 添加新功能

以添加新的提供者为例：

1. **创建提供者文件**

```typescript
// src/myProvider.ts
import * as vscode from 'vscode';

export class MyProvider implements vscode.SomeProvider {
  provideSomething(...): vscode.ProviderResult<...> {
    // 实现
  }
}
```

2. **在 extension.ts 中注册**

```typescript
import { MyProvider } from './myProvider';

const myProvider = new MyProvider();
context.subscriptions.push(
  vscode.languages.registerSomeProvider(selector, myProvider)
);
```

3. **添加命令（如果需要）**

在 `package.json` 的 `contributes.commands` 中添加：

```json
{
  "command": "kaula.myCommand",
  "title": "My Command",
  "category": "Kaula"
}
```

在 `extension.ts` 中注册命令处理：

```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('kaula.myCommand', () => {
    // 处理逻辑
  })
);
```

4. **添加配置项（如果需要）**

在 `package.json` 的 `contributes.configuration.properties` 中添加：

```json
"kaula.myOption": {
  "type": "boolean",
  "default": true,
  "description": "My option description"
}
```

5. **更新文档**

- 更新 [01-features.md](01-features.md) 添加功能说明
- 更新 [02-commands.md](02-commands.md) 添加命令说明
- 更新 [03-configuration.md](03-configuration.md) 添加配置说明
- 更新 [CHANGELOG.md](../CHANGELOG.md) 记录变更

## 编译器集成

插件依赖两个编译器工具：

### `kaulac`（编译器）
- 路径：`kaula/kaula-compiler/cmd/kaulac/kaulac.exe`
- 用于：
  - `buildProvider.ts` 中的编译/运行
  - `compilerDiagnosticsProvider.ts` 中的静态分析（`--check`）
  - source map 生成（`--sourcemap`）

### `kaulafmt`（格式化工具）
- 路径：`kaula/kaula-compiler/cmd/kaulafmt/kaulafmt.exe`
- 用于 `formatProvider.ts` 中的代码格式化

## 编译器端 Source Map 实现

Source map 功能需要编译器端配合：

- [sourcemap.go](../../kaula/kaula-compiler/internal/codegen/sourcemap.go)：SourceMap 数据结构
- [codegen.go](../../kaula/kaula-compiler/internal/codegen/codegen.go)：在代码生成时收集行映射
- [main.go](../../kaula/kaula-compiler/cmd/kaulac/main.go)：`--sourcemap` 命令行选项

## 编译与发布

```bash
# 安装 vsce（VS Code Extension CLI）
npm install -g vsce

# 打包 vsix
vsce package

# 发布到 Marketplace
vsce publish
```
