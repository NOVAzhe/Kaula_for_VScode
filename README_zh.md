# Kaula 语言 VS Code 支持

[English Documentation](README.md)

## 概述

**Kaula Language** 是一款为 **Kaula** 编程语言提供全面支持的 VS Code 扩展插件。Kaula 是一门高性能系统编程语言，其独特的 **SOR（Scoped Ownership Release，作用域所有权释放）** 范式在编译期保证内存安全，同时在性能和内存效率上超越传统方案。

## 功能特性

- **语法高亮** — 完整的 TextMate 语法支持，涵盖 Kaula 核心语法与 SOR 扩展语法
- **语言配置** — 括号匹配、自动闭合、注释切换、代码折叠
- **代码片段** — 内置常用 Kaula 代码模板，提升开发效率
- **标准库智能补全** — 基于 IntelliSense 的标准库自动补全建议
- **Release DAG 依赖诊断** — 可视化展示所有权释放依赖图，帮助你在编译期检测循环依赖和所有权违规

## SOR 范式

**SOR（Scoped Ownership Release，作用域所有权释放）** 子系统是 Kaula 的核心亮点：

- **编译期所有权安全** — 所有所有权转移在编译阶段完成验证
- **零拷贝语义** — 智能指针/引用决策消除不必要的数据拷贝
- **函数级 `#[sor]` 注解** — 按函数粒度启用 SOR 分析，实现细粒度控制
- **增强的静态分析** — 智能化的编译期信息推断，包括活跃性分析、逃逸分析和过程间分析
- **性能提升** — 在多种场景下，SOR 相比传统内存管理在速度和内存效率上均有优势

## 配置项

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `kaula.kaulacPath` | string | `""` | `kaulac` 编译器的可执行文件路径 |
| `kaula.sorDiagnostics.enable` | boolean | `true` | 是否启用 Release DAG 依赖诊断 |

## 环境要求

- VS Code **1.75.0** 或更高版本
- 已安装并可访问的 Kaula 编译器（`kaulac`）

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
├── syntaxes/          # TextMate 语法文件
│   ├── kaula.tmLanguage.json       # 核心语言语法
│   └── kaula-sor.tmLanguage.json   # SOR 扩展语法
├── snippets/          # 代码片段
│   └── kaula.json
├── src/               # TypeScript 源代码
│   ├── extension.ts
│   ├── completionProvider.ts
│   ├── sorDiagnosticsProvider.ts
│   └── stdlibData.ts
├── out/               # 编译后的 JavaScript 输出
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

## 许可证

详见 [LICENSE](LICENSE) 文件。