# Kaula Language Support for VS Code

[中文文档](README.md)

## Overview

**Kaula Language** is a VS Code extension that provides comprehensive language support for the **Kaula** programming language. Kaula is a high-performance systems programming language featuring a unique **SOR (Scoped Ownership Release)** paradigm that guarantees memory safety at compile time while delivering superior performance and memory efficiency compared to traditional approaches.

## Features

- **Syntax Highlighting** — Full TextMate grammar support for Kaula core language and SOR extension syntax
- **Language Configuration** — Bracket matching, auto-closing pairs, comment toggling, and code folding
- **Code Snippets** — Pre-built snippets for common Kaula patterns to boost productivity
- **Standard Library Auto-Completion** — Intelligent IntelliSense suggestions for the Kaula standard library
- **Release DAG Diagnostics** — Visual diagnostics for ownership release dependency graphs, helping you detect circular dependencies and ownership violations at compile time

## SOR Paradigm

The **SOR (Scoped Ownership Release)** subsystem is Kaula's flagship feature:

- **Compile-time ownership safety** — All ownership transfers are verified during compilation
- **Zero-copy semantics** — Smart pointer/reference decisions eliminate unnecessary data copies
- **Function-level `#[sor]` annotation** — Opt into SOR analysis per function for fine-grained control
- **Enhanced static analysis** — Intelligent compile-time information including liveness analysis, escape analysis, and inter-procedural analysis
- **Performance gains** — In many scenarios, SOR outperforms traditional memory management in both speed and memory efficiency

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kaula.kaulacPath` | string | `""` | Path to the `kaulac` compiler executable |
| `kaula.sorDiagnostics.enable` | boolean | `true` | Enable release DAG dependency diagnostics |

## Requirements

- VS Code **1.75.0** or higher
- Kaula compiler (`kaulac`) installed and accessible

## Installation

1. Open VS Code
2. Go to **Extensions** (`Ctrl+Shift+X`)
3. Search for **"Kaula Language"**
4. Click **Install**

Alternatively, install from a `.vsix` file:
```bash
code --install-extension kaula-language-0.1.0.vsix
```

## Project Structure

```
kaula_for_vscode/
├── syntaxes/          # TextMate grammar files
│   ├── kaula.tmLanguage.json       # Core language grammar
│   └── kaula-sor.tmLanguage.json   # SOR extension grammar
├── snippets/          # Code snippets
│   └── kaula.json
├── src/               # TypeScript source code
│   ├── extension.ts
│   ├── completionProvider.ts
│   ├── sorDiagnosticsProvider.ts
│   └── stdlibData.ts
├── out/               # Compiled JavaScript output
├── language-configuration.json
├── package.json
└── tsconfig.json
```

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch
```

To debug the extension, press `F5` in VS Code to launch an Extension Development Host.

## License

See [LICENSE](LICENSE) for details.