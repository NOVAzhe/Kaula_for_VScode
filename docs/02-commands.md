# 02 — 命令参考

所有命令均位于 `Kaula` 命令类别下，可通过 `Ctrl+Shift+P` 命令面板访问。

## 命令列表

| 命令 ID | 标题 | 说明 |
|---|---|---|
| `kaula.build` | Build Kaula File | 编译当前 Kaula 文件 |
| `kaula.run` | Build and Run Kaula File | 编译并运行当前文件 |
| `kaula.showMapping` | Show Source Mapping View (KL vs C) | 打开 KL/C 分屏映射视图 |
| `kaula.toggleSyncScroll` | Toggle Sync Scroll in Mapping View | 切换映射视图同步滚动 |
| `kaula.jumpToKL` | Jump to Kaula Source (from C) | 从 C 代码跳转到 KL 源码 |
| `kaula.jumpToC` | Jump to Generated C Code | 从 KL 源码跳转到 C 代码 |

## 详细说明

### `kaula.build`
编译当前打开的 `.kl` 文件。

- 在 VSCode 集成终端中执行 `kaulac`
- 自动添加 `--sourcemap` 选项（可通过 `kaula.build.sourceMap` 关闭）
- 如果启用了 `kaula.build.sor`，会添加 `--sor` 选项

**等效命令行：**
```bash
kaulac --sourcemap [--sor] myfile.kl
```

### `kaula.run`
编译并立即运行当前文件。

- 先编译，成功后自动执行生成的可执行文件
- 与 `kaula.build` 使用相同的编译选项

**等效命令行：**
```bash
kaulac --sourcemap [--sor] myfile.kl && myfile.exe
```

### `kaula.showMapping`
打开 KL/C 分屏映射视图。

- 如果在 `.kl` 文件中执行：右侧打开对应的 `.c` 文件
- 如果在 `.c` 文件中执行：左侧打开对应的 `.kl` 源文件
- 自动加载 `.map.json` 文件
- 启用行染色高亮和同步滚动

### `kaula.toggleSyncScroll`
切换映射视图的同步滚动行为。

- 默认开启（可通过 `kaula.mapping.syncScroll` 配置）
- 关闭后两个编辑器可独立滚动，但行高亮仍生效

### `kaula.jumpToKL`
从 C 代码跳转到对应的 Kaula 源码位置。

- 必须在 `.c` 文件中执行
- 基于当前光标行号查找 source map
- 如果未找到映射，会提示确保编译时使用了 `--sourcemap`

### `kaula.jumpToC`
从 Kaula 源码跳转到对应的 C 代码位置。

- 必须在 `.kl` 文件中执行
- 基于当前光标行号查找 source map

## 编辑器内触发

除了命令面板，以下功能还支持编辑器内快捷操作：

| 功能 | 快捷键 | 说明 |
|---|---|---|
| 定义跳转 | `F12` | KL 文件内跳转到声明 |
| 引用查找 | `Shift+F12` | 查找所有引用 |
| 重命名 | `F2` | 重命名符号 |
| 格式化 | `Shift+Alt+F` | 格式化整个文档 |
| C → KL 跳转 | `F12` | 在 C 文件中跳转到 KL 源码 |
| 函数签名 | 自动触发 | 输入 `(` 或 `,` 时 |
