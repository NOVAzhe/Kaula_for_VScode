# 01 — 功能概览

Kaula IDE 插件为 `.kl` 文件提供完整的语言服务体验。所有功能都基于 Kaula 编译器的实际语法和语义实现。

## 1. 语言基础

### 语法高亮
- 基于 TextMate 语法文件 [kaula.tmLanguage.json](../syntaxes/kaula.tmLanguage.json)
- 支持 Kaula 核心语法：函数、类、结构体、接口、prefix、tree 等
- 注释支持 `//` 和 `#`（`#[...]` 除外）
- 类型关键字与普通关键字分别着色

### 语言配置
- 括号自动闭合：`()`、`[]`、`{}`
- 自动缩进
- 注释切换：`Ctrl+/`
- 代码折叠：基于 `{}` 块结构

### 代码片段
- SOR 函数模板（`#[sor]` 注解）
- 函数参数中的 `task()` / `async()` 语法
- 标准库 import 模块列表

## 2. 智能补全

详见 [completionProvider.ts](../src/completionProvider.ts)。

| 触发场景 | 补全内容 |
|---|---|
| `import ` | `std` 根模块 |
| `import std.` | 标准库模块列表（io、math、net、time、os、windows、syscall 等） |
| `std.module.` | 该模块的函数列表 |
| 标识符后输入 `.` | 成员访问、`vo.create()`、`prefix.enter()` |
| `yeide` / `release` / `extract ... ->` | 已声明的变量列表 |
| 函数名后 | 自动插入括号并定位光标到参数位置 |
| 任意位置 | Kaula 关键字、内置类型、类型别名（i8-i64 等）、常量（true/false/null） |

## 3. 类型提示

详见 [typeProvider.ts](../src/typeProvider.ts)。

### Hover 类型提示

悬停于以下标识符上会显示类型信息：

| 悬停对象 | 显示内容 |
|---|---|
| 变量名 | 类型 + 声明行号 + `auto` 推断标记 |
| 函数名 | 完整函数签名 + 声明位置 |
| `std.io.print` 等 | 标准库函数签名 + 来源头文件 |
| `String` 等类型 | 类型描述 + 所属模块 |
| `int` / `i64` / `bool` 等 | 内置类型说明 |

### 函数签名帮助

输入函数调用 `func(` 时自动弹出：
- 完整函数签名（参数类型 + 参数名 + 返回类型）
- 当前输入参数高亮
- 触发字符：`(` 和 `,`

## 4. 诊断

### SOR DAG 诊断
详见 [sorDiagnosticsProvider.ts](../src/sorDiagnosticsProvider.ts)。

- 追踪 `release` 语句构建依赖 DAG
- 检测循环依赖
- 检测 `yeide` 后的 use-after-move
- 追踪 `yeide` 和 `extract` 语句
- Hover 提示和行内装饰

### 编译器静态分析
详见 [compilerDiagnosticsProvider.ts](../src/compilerDiagnosticsProvider.ts)。

- 调用 `kaulac --check` 进行静态分析
- 文档打开/变更时自动运行
- 解析编译器输出并生成 VSCode 诊断
- 支持错误和警告级别

## 5. 导航

### 定义跳转（Go to Definition）
详见 [definitionProvider.ts](../src/definitionProvider.ts)。

- `F12` 跳转到变量/函数声明位置
- 支持 `std.module.func` 标准库函数
- 支持普通函数调用和变量引用

### 引用查找（Find References）
详见 [referenceProvider.ts](../src/referenceProvider.ts)。

- `Shift+F12` 查找当前文件内所有引用
- 自动排除字符串和注释中的匹配

### 文件符号导航（Outline）
详见 [symbolProvider.ts](../src/symbolProvider.ts)。

- 侧边栏大纲显示文件结构
- 识别 `fn`、`struct`、`class`、`interface`、`type`、`prefix`、`pub` 变量

## 6. 重构

### 重命名符号（Rename Symbol）
详见 [renameProvider.ts](../src/renameProvider.ts)。

- `F2` 重命名变量/函数
- 自动更新当前文件所有引用
- 排除注释和字符串中的匹配

## 7. 格式化

详见 [formatProvider.ts](../src/formatProvider.ts)。

- `Shift+Alt+F` 格式化文档
- 调用 `kaulafmt` 工具
- 通过 `stdin` 传递代码，不修改原文件
- 自动查找 `kaulafmt.exe` 路径

## 8. 编译/运行集成

详见 [buildProvider.ts](../src/buildProvider.ts)。

- `Kaula: Build Kaula File` — 编译当前文件
- `Kaula: Build and Run Kaula File` — 编译并运行
- 默认启用 `--sourcemap` 选项
- 可选启用 `--sor` 选项
- 输出到 VSCode 集成终端

## 9. 源码映射

详见 [04 — 源码映射](04-source-map.md)。

- KL ↔ C 代码行级映射
- 分屏视图，对应行染色高亮
- 同步滚动
- F12 在 C 文件中跳转到 KL 源码
