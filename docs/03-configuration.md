# 03 — 配置项

所有配置项位于 VSCode 设置的 `Kaula` 分类下，可在 `settings.json` 中以 `kaula.` 前缀配置。

## 配置项总览

| 设置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `kaula.build.kaulacPath` | string | `""` | kaulac 编译器可执行文件路径 |
| `kaula.build.sor` | boolean | `false` | 编译时启用 SOR 分析 |
| `kaula.build.sourceMap` | boolean | `true` | 编译时生成 source map 文件 |
| `kaula.format.kaulafmtPath` | string | `""` | kaulafmt 格式化工具可执行文件路径 |
| `kaula.mapping.syncScroll` | boolean | `true` | 映射视图中启用同步滚动 |
| `kaula.sorDiagnostics.enable` | boolean | `true` | 启用 Release DAG 依赖诊断 |

## 详细说明

### `kaula.build.kaulacPath`
指定 `kaulac` 编译器的完整路径。

- 留空时插件会按以下顺序自动查找：
  1. `kaula/kaula-compiler/cmd/kaulac/kaulac.exe`（相对插件目录）
  2. 插件 `bin/` 子目录
- 如果使用了非默认路径安装编译器，必须显式指定

**示例：**
```json
{
  "kaula.build.kaulacPath": "C:\\kaula\\bin\\kaulac.exe"
}
```

### `kaula.build.sor`
编译时启用 SOR（作用域所有权释放）分析。

- 启用后会传递 `--sor` 选项给 `kaulac`
- SOR 启用后默认使用 `-O3` 优化级别
- 参见 [SOR 范式](../README.md#sor-范式) 了解 SOR 的优势

**示例：**
```json
{
  "kaula.build.sor": true
}
```

### `kaula.build.sourceMap`
编译时是否生成 source map 文件（`.map.json`）。

- 默认开启，生成到 `cache/` 目录
- 关闭后 [源码映射](04-source-map.md) 功能将不可用
- 也可以在命令行手动指定 `--sourcemap`

**示例：**
```json
{
  "kaula.build.sourceMap": false
}
```

### `kaula.format.kaulafmtPath`
指定 `kaulafmt` 格式化工具的完整路径。

- 留空时插件会自动查找，查找顺序：
  1. `kaula/kaula-compiler/cmd/kaulafmt/kaulafmt.exe`
  2. 插件 `bin/` 子目录
- 找不到时执行 `Shift+Alt+F` 会显示警告

**示例：**
```json
{
  "kaula.format.kaulafmtPath": "C:\\kaula\\bin\\kaulafmt.exe"
}
```

### `kaula.mapping.syncScroll`
源码映射视图中是否启用同步滚动。

- 开启后两个编辑器会联动滚动到对应位置
- 关闭后仍会显示行高亮，但不会自动滚动
- 可通过命令 `Kaula: Toggle Sync Scroll in Mapping View` 在运行时切换

**示例：**
```json
{
  "kaula.mapping.syncScroll": false
}
```

### `kaula.sorDiagnostics.enable`
启用 Release DAG 依赖诊断。

- 启用后会分析 `release` / `yeide` / `extract` 语句的依赖关系
- 检测循环依赖和 use-after-move
- 详见 [sorDiagnosticsProvider.ts](../src/sorDiagnosticsProvider.ts)

**示例：**
```json
{
  "kaula.sorDiagnostics.enable": true
}
```

## 配置示例

完整的 `settings.json` 示例：

```json
{
  "kaula.build.kaulacPath": "C:\\kaula\\bin\\kaulac.exe",
  "kaula.build.sor": true,
  "kaula.build.sourceMap": true,
  "kaula.format.kaulafmtPath": "C:\\kaula\\bin\\kaulafmt.exe",
  "kaula.mapping.syncScroll": true,
  "kaula.sorDiagnostics.enable": true
}
```
