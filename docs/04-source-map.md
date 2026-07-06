# 04 — 源码映射（Source Map）

Kaula IDE 插件支持 KL 源码与生成的 C 代码之间的行级映射。这是通过编译器生成的 `.map.json` 文件实现的。

## 工作原理

### 1. 编译时生成 source map

当 `kaulac` 使用 `--sourcemap` 选项编译时：

```bash
kaulac --sourcemap myfile.kl
```

编译器会输出 `cache/myfile.map.json` 文件，记录每个生成的 C 代码行号对应的 KL 源码位置。

### 2. Source map 文件格式

`.map.json` 文件格式：

```json
{
  "version": 1,
  "source": "myfile.kl",
  "target": "cache/myfile.c",
  "entries": [
    {
      "generated_line": 10,
      "source_file": "myfile.kl",
      "source_line": 1,
      "source_column": 3,
      "kind": "function",
      "symbol_name": "add"
    },
    {
      "generated_line": 14,
      "source_file": "myfile.kl",
      "source_line": 3,
      "source_column": 3,
      "kind": "function",
      "symbol_name": "main"
    }
  ]
}
```

### 3. 映射粒度

当前映射记录以下元素：

| kind | 说明 |
|---|---|
| `function` | 函数定义（包括 main） |
| `class` | 类定义 |
| `interface` | 接口定义 |
| `struct` | 结构体定义 |
| `type` | 类型别名定义 |
| `variable` | 全局变量声明 |
| `statement` | main 函数体中的语句 |

> 当前为函数/语句级别映射。函数内部的详细语句映射需要进一步扩展。

## 查找规则

插件在以下位置查找 `.map.json` 文件：

1. `.c.map.json`（与 C 文件同目录）
2. `cache/<basename>.map.json`（工作区 cache 目录）
3. `<basename>.map.json`（与源文件同目录）

## 使用方式

### 1. 分屏映射视图

命令：`Kaula: Show Source Mapping View (KL vs C)`

- 左右分屏显示 KL 和 C 代码
- 有映射关系的行以蓝色高亮
- 当前光标所在行及对应行以橙色高亮
- 移动光标时另一侧自动滚动到对应位置

![映射视图示意图]

### 2. C → KL 跳转

在 C 文件中：
- `F12`（定义跳转）跳转到对应的 KL 源码位置
- 或使用命令 `Kaula: Jump to Kaula Source (from C)`

### 3. KL → C 跳转

在 KL 文件中：
- 使用命令 `Kaula: Jump to Generated C Code` 跳转到对应的 C 代码位置

### 4. 同步滚动切换

命令：`Kaula: Toggle Sync Scroll in Mapping View`

- 关闭后两个编辑器可独立滚动
- 行高亮仍生效，但不会自动滚动

## 在 VSCode 中编译自动生成

默认情况下，使用插件的 `kaula.build` 或 `kaula.run` 命令编译时会自动添加 `--sourcemap` 选项（由 `kaula.build.sourceMap` 配置控制，默认为 `true`）。

## 命令行编译

如果从命令行编译，需要手动添加 `--sourcemap`：

```bash
# 普通编译
kaulac --sourcemap myfile.kl

# SOR 模式编译
kaulac --sourcemap --sor myfile.kl

# 不使用缓存
kaulac --sourcemap --no-cache myfile.kl
```

## 注意事项

- Source map 仅在编译成功后生成
- 修改 KL 源码后需要重新编译才能更新映射
- 如果删除了 `cache/` 目录，需要重新编译
- 映射视图打开后会监听文件保存事件，自动重新加载 map
