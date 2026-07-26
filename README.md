# Kaula 语言 VS Code 支持

[English Documentation](README_en.md) | [详细文档](docs/README.md)

## 概述

**Kaula Language** 是一款为 **Kaula** 编程语言提供全面支持的 VS Code 扩展插件。Kaula 是一门高性能系统编程语言，其独特的 **SOR（Scoped Ownership Release，作用域所有权释放）** 范式在编译期保证内存安全，同时在性能和内存效率上超越传统方案。

## 功能特性

### 语言基础
- **语法高亮** — 完整的 TextMate 语法支持，涵盖 Kaula 核心语法与 SOR 扩展语法，支持 for-in / range 系语句
- **语言配置** — 括号匹配、自动闭合、`//` 和 `#` 注释切换、代码折叠
- **代码片段** — 内置 SOR 函数、`task()`/`async()` 参数、标准库 import、for-range 循环等模板

### 智能编辑
- **标准库智能补全** — 基于 IntelliSense 的标准库自动补全（`std.module.func`）
- **类型提示** — Hover 显示变量/函数类型，`auto` 推断，函数签名帮助
- **代码格式化** — 集成 `kaulafmt` 工具（`Shift+Alt+F`）
- **SOR DAG 诊断** — 可视化展示所有权释放依赖图，检测循环依赖和 use-after-move
- **编译器静态分析** — 调用 `kaulac --check` 进行深度错误诊断

### 导航与重构
- **定义跳转** — `F12` 跳转到变量/函数声明
- **引用查找** — `Shift+F12` 查找所有引用
- **文件符号导航** — 侧边栏大纲显示 `fn`/`struct`/`class`/`interface` 等
- **重命名符号** — `F2` 重命名并更新所有引用

### 编译集成
- **编译/运行** — `Kaula: Build` 和 `Kaula: Run` 命令
- **SOR 模式** — 可选启用 `--sor` 编译时所有权分析

### 源码映射（KL ↔ C）
- **Source Map 生成** — 编译时默认生成 `.map.json` 文件
- **分屏映射视图** — 左右分栏显示 KL 和 C 代码，对应行染色高亮
- **同步滚动** — 光标移动时另一侧自动滚动到对应位置
- **双向跳转** — `F12` 在 C 文件中跳转到 KL 源码，命令跳转到 C 代码

## SOR 范式

**SOR（Scoped Ownership Release，作用域所有权释放）** 子系统是 Kaula 的核心亮点：

- **编译期所有权安全** — 所有所有权转移在编译阶段完成验证
- **零拷贝语义** — 智能指针/引用决策消除不必要的数据拷贝
- **函数级 `#[sor]` 注解** — 按函数粒度启用 SOR 分析，实现细粒度控制
- **增强的静态分析** — 智能化的编译期信息推断，包括活跃性分析、逃逸分析和过程间分析
- **性能提升** — 在多种场景下，SOR 相比传统内存管理在速度和内存效率上均有优势

## 命令

所有命令位于 `Kaula` 类别下，通过 `Ctrl+Shift+P` 访问。

| 命令 | 说明 |
|---|---|
| `Kaula: Build Kaula File` | 编译当前文件 |
| `Kaula: Build and Run Kaula File` | 编译并运行 |
| `Kaula: Show Source Mapping View (KL vs C)` | 打开分屏映射视图 |
| `Kaula: Toggle Sync Scroll in Mapping View` | 切换同步滚动 |
| `Kaula: Jump to Kaula Source (from C)` | C → KL 跳转 |
| `Kaula: Jump to Generated C Code` | KL → C 跳转 |

详见 [命令参考](docs/02-commands.md)。

## 配置项

| 设置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `kaula.build.kaulacPath` | string | `""` | `kaulac` 编译器可执行文件路径 |
| `kaula.build.sor` | boolean | `false` | 编译时启用 SOR 分析 |
| `kaula.build.sourceMap` | boolean | `true` | 编译时生成 source map 文件 |
| `kaula.format.kaulafmtPath` | string | `""` | `kaulafmt` 格式化工具路径 |
| `kaula.mapping.syncScroll` | boolean | `true` | 映射视图启用同步滚动 |
| `kaula.sorDiagnostics.enable` | boolean | `true` | 启用 Release DAG 依赖诊断 |

详见 [配置项文档](docs/03-configuration.md)。

## 环境要求

- VS Code **1.75.0** 或更高版本
- Kaula 编译器（`kaulac`）和格式化工具（`kaulafmt`）—— 插件会自动查找 Toolkit 目录下的可执行文件

## 安装方式

1. 打开 VS Code
2. 进入 **扩展** 面板（`Ctrl+Shift+X`）
3. 搜索 **"Kaula Language"**
4. 点击 **安装**

或者从 `.vsix` 文件安装：
```bash
code --install-extension kaula-language-0.1.0.vsix
```

## 项目结构

```
kaula_for_vscode/
├── syntaxes/                              # TextMate 语法文件
│   ├── kaula.tmLanguage.json             # 核心语言语法
│   └── kaula-sor.tmLanguage.json         # SOR 扩展语法
├── snippets/                              # 代码片段
│   └── kaula.json
├── src/                                   # TypeScript 源代码
│   ├── extension.ts                      # 插件入口
│   ├── completionProvider.ts             # 智能补全
│   ├── typeProvider.ts                   # 类型推断和 Hover
│   ├── definitionProvider.ts             # 定义跳转
│   ├── referenceProvider.ts              # 引用查找
│   ├── symbolProvider.ts                # 文件符号导航
│   ├── renameProvider.ts                # 重命名符号
│   ├── formatProvider.ts                 # 代码格式化
│   ├── buildProvider.ts                 # 编译/运行集成
│   ├── sorDiagnosticsProvider.ts         # SOR DAG 诊断
│   ├── compilerDiagnosticsProvider.ts    # 编译器静态分析
│   ├── sourceMapProvider.ts              # Source Map 加载
│   ├── mappingView.ts                   # 分屏映射视图
│   └── stdlibData.ts                     # 标准库元数据
├── docs/                                 # 详细文档
│   ├── README.md
│   ├── 01-features.md
│   ├── 02-commands.md
│   ├── 03-configuration.md
│   ├── 04-source-map.md
│   └── 05-architecture.md
├── out/                                  # 编译输出
├── language-configuration.json
├── package.json
└── tsconfig.json
```

## 开发指南

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 开发监听模式
npm run watch
```

在 VS Code 中按 `F5` 启动扩展开发主机进行调试。

详见 [架构与开发文档](docs/05-architecture.md)。

## 文档

- [功能概览](docs/01-features.md)
- [命令参考](docs/02-commands.md)
- [配置项](docs/03-configuration.md)
- [源码映射](docs/04-source-map.md)
- [架构与开发](docs/05-architecture.md)
- [更新日志](CHANGELOG.md)

## 许可证

详见 [LICENSE](LICENSE) 文件。
