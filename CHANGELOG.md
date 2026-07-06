# Changelog

## 0.2.0

### Added — Smart Editing
- Type inference engine with Hover tooltips for variables, functions, and standard library symbols
- Function signature help triggered by `(` and `,`
- `auto` type inference for literals and standard library return values
- Code formatting via `kaulafmt` integration (`Shift+Alt+F`)
- Compiler static analysis diagnostics via `kaulac --check`
- SOR `yeide`/`extract` statement tracking and use-after-move detection

### Added — Navigation & Refactoring
- Go to Definition (`F12`) for variables, functions, and `std.module.func` calls
- Find References (`Shift+F12`) with string/comment exclusion
- Document Symbols (Outline) for `fn`/`struct`/`class`/`interface`/`type`/`prefix`/`pub`
- Rename Symbol (`F2`) with reference updates

### Added — Build Integration
- `Kaula: Build Kaula File` command
- `Kaula: Build and Run Kaula File` command
- Optional `--sor` compilation flag via `kaula.build.sor` setting
- Automatic `kaulac` and `kaulafmt` executable discovery

### Added — Source Mapping (KL ↔ C)
- `--sourcemap` compiler option generating `.map.json` files
- Source map data structure in compiler codegen (`sourcemap.go`)
- `SourceMapProvider` for loading and querying map files
- Split mapping view with line-level color highlighting
- Synchronized scrolling between KL and C editors
- `Kaula: Show Source Mapping View (KL vs C)` command
- `Kaula: Toggle Sync Scroll in Mapping View` command
- `Kaula: Jump to Kaula Source (from C)` command
- `Kaula: Jump to Generated C Code` command
- C file Definition Provider for F12 jump to KL source

### Added — Configuration
- `kaula.build.kaulacPath` — path to kaulac compiler
- `kaula.build.sor` — enable SOR analysis during build
- `kaula.build.sourceMap` — generate source map (default: `true`)
- `kaula.format.kaulafmtPath` — path to kaulafmt formatter
- `kaula.mapping.syncScroll` — enable sync scroll in mapping view

### Enhanced — Completion
- Import statement completion (`import std.` → module list)
- `vo.` and `prefix.` member access completion
- SOR arrow context completion (`yeide`/`release`/`extract ... ->`)
- Function completion auto-inserts parentheses
- Separated type keywords, type aliases, and built-in constants

### Enhanced — Snippets
- Fixed SOR function snippet (removed invalid `->` return type syntax)
- Removed non-existent `spawn` snippet
- Added `task-param` and `async-param` snippets
- Added missing `windows` and `syscall` import modules

### Enhanced — Language Configuration
- Added `#` as line comment marker (excluding `#[...]`)

### Documentation
- Created `docs/` folder with chapter-based documentation
- Updated README.md, README_zh.md, README_en.md with full feature list
- Added detailed docs for features, commands, configuration, source map, and architecture

## 0.1.0

- Initial release
- TextMate syntax highlighting for Kaula core and SOR extension
- Language configuration (brackets, comments, folding)
- Code snippets
- Standard library auto-completion
- Release DAG dependency diagnostics
