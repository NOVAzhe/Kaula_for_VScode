import * as vscode from 'vscode';

// ============================================================================
// SOR 所有权流分析
// 跟踪三种 SOR 构造：
//   yeide   source -> target            所有权转移（单一目标）
//   release source -> [a, b, c]         所有权分发（DAG）
//   extract source[index] -> target      子结构提取
// ============================================================================

interface ReleaseEdge {
  from: string;
  to: string[];
  line: number;
  range: vscode.Range;
}

interface YeideEdge {
  from: string;
  to: string;
  line: number;
  range: vscode.Range;
}

interface ExtractEdge {
  from: string;
  index: string;
  to: string;
  line: number;
  range: vscode.Range;
}

class DAGChecker {
  private adjacency: Map<string, Set<string>> = new Map();
  private edges: ReleaseEdge[] = [];

  addEdge(from: string, to: string[], line: number, range: vscode.Range): void {
    this.edges.push({ from, to, line, range });
    if (!this.adjacency.has(from)) {
      this.adjacency.set(from, new Set());
    }
    for (const t of to) {
      this.adjacency.get(from)!.add(t);
      if (!this.adjacency.has(t)) {
        this.adjacency.set(t, new Set());
      }
    }
  }

  clear(): void {
    this.adjacency.clear();
    this.edges = [];
  }

  // DFS 三色标记法环检测
  // WHITE=0, GRAY=1, BLACK=2
  detectCycle(): string[] | null {
    const color: Map<string, number> = new Map();
    const parent: Map<string, string> = new Map();

    for (const node of this.adjacency.keys()) {
      color.set(node, 0); // WHITE
    }

    for (const node of this.adjacency.keys()) {
      if (color.get(node) === 0) {
        const cycle = this.dfs(node, color, parent);
        if (cycle) { return cycle; }
      }
    }
    return null;
  }

  private dfs(node: string, color: Map<string, number>, parent: Map<string, string>): string[] | null {
    color.set(node, 1); // GRAY

    const neighbors = this.adjacency.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (color.get(neighbor) === 1) {
          // 找到环，回溯
          const cycle: string[] = [neighbor, node];
          let current = node;
          while (parent.has(current) && parent.get(current) !== neighbor) {
            current = parent.get(current)!;
            cycle.push(current);
          }
          cycle.reverse();
          return cycle;
        }
        if (color.get(neighbor) === 0) {
          parent.set(neighbor, node);
          const cycle = this.dfs(neighbor, color, parent);
          if (cycle) { return cycle; }
        }
      }
    }

    color.set(node, 2); // BLACK
    return null;
  }

  getEdges(): ReleaseEdge[] {
    return this.edges;
  }

  getNodeCount(): number {
    return this.adjacency.size;
  }

  getEdgeCount(): number {
    let count = 0;
    for (const neighbors of this.adjacency.values()) {
      count += neighbors.size;
    }
    return count;
  }
}

// SOR 语句正则模式
const RELEASE_PATTERN = /release\s+([a-zA-Z_]\w*)\s*->\s*\[([^\]]+)\]/g;
const YEIDE_PATTERN = /yeide\s+([a-zA-Z_]\w*)\s*->\s*([a-zA-Z_]\w*)/g;
const EXTRACT_PATTERN = /extract\s+([a-zA-Z_]\w*)\s*\[([^\]]*)\]\s*->\s*([a-zA-Z_]\w*)/g;

export class SORDiagnosticsProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private dagChecker: DAGChecker;
  private yeideEdges: YeideEdge[] = [];
  private extractEdges: ExtractEdge[] = [];
  private decorationType: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('kaula-sor');
    this.dagChecker = new DAGChecker();
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#4FC1FF',
        fontStyle: 'italic',
        margin: '0 0 0 1em'
      }
    });
    this.disposables.push(this.diagnosticCollection);
  }

  updateDiagnostics(document: vscode.TextDocument): void {
    const config = vscode.workspace.getConfiguration('kaula');
    if (!config.get<boolean>('sorDiagnostics.enable', true)) {
      this.diagnosticCollection.clear();
      return;
    }

    this.dagChecker.clear();
    this.yeideEdges = [];
    this.extractEdges = [];
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    // 1. 解析 yeide 语句：yeide source -> target
    this.parseYeideStatements(text, document);

    // 2. 解析 release 语句：release source -> [holders]
    this.parseReleaseStatements(text, document);

    // 3. 解析 extract 语句：extract source[index] -> target
    this.parseExtractStatements(text, document);

    // 4. release 环检测
    const cycle = this.dagChecker.detectCycle();
    if (cycle) {
      const cycleStr = cycle.join(' → ');
      // 只为参与环的边报告错误，而不是所有边
      const cycleSet = new Set(cycle);
      for (const edge of this.dagChecker.getEdges()) {
        if (cycleSet.has(edge.from) || edge.to.some(t => cycleSet.has(t))) {
          const diag = new vscode.Diagnostic(
            edge.range,
            `Release cycle detected: ${cycleStr}`,
            vscode.DiagnosticSeverity.Error
          );
          diag.source = 'kaula-sor';
          diagnostics.push(diag);
        }
      }
    }

    // 5. yeide 使用后转移检测（use-after-move）
    this.checkYeideUseAfterMove(text, document, diagnostics);

    // 6. 检查 yeide 目标是否未定义
    this.checkYeideUndefinedTarget(diagnostics);

    this.diagnosticCollection.set(document.uri, diagnostics);

    // 更新 Decoration（视觉提示）
    this.updateDecorations(document, cycle);
  }

  private parseYeideStatements(text: string, document: vscode.TextDocument): void {
    const regex = new RegExp(YEIDE_PATTERN.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const source = match[1];
      const target = match[2];
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);
      this.yeideEdges.push({ from: source, to: target, line: startPos.line, range });
    }
  }

  private parseReleaseStatements(text: string, document: vscode.TextDocument): void {
    const regex = new RegExp(RELEASE_PATTERN.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const source = match[1];
      const holders = match[2].split(',').map(h => h.trim()).filter(h => h.length > 0);
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);
      this.dagChecker.addEdge(source, holders, startPos.line, range);
    }
  }

  private parseExtractStatements(text: string, document: vscode.TextDocument): void {
    const regex = new RegExp(EXTRACT_PATTERN.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const source = match[1];
      const index = match[2].trim();
      const target = match[3];
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);
      this.extractEdges.push({ from: source, index, to: target, line: startPos.line, range });
    }
  }

  // 检查 yeide 源在转移后是否被再次使用
  private checkYeideUseAfterMove(text: string, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
    for (const edge of this.yeideEdges) {
      // 简单检查：在 yeide 行之后是否有对源变量的读取
      const lines = text.split('\n');
      for (let i = edge.line + 1; i < lines.length; i++) {
        const line = lines[i];
        // 跳过注释行
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('#')) { continue; }
        // 检查是否引用了源变量（作为标识符，不是赋值目标）
        const usagePattern = new RegExp(`\\b${edge.from}\\b`);
        if (usagePattern.test(line)) {
          // 检查是否是赋值目标（如果是赋值，则是重新绑定，不算 use-after-move）
          const assignPattern = new RegExp(`^\\s*\\w+\\s+${edge.from}\\s*=|\\bauto\\s+${edge.from}\\s*=`);
          if (!assignPattern.test(line)) {
            const sourceLine = i;
            if (sourceLine < document.lineCount) {
              const range = new vscode.Range(
                new vscode.Position(sourceLine, 0),
                new vscode.Position(sourceLine, lines[i].length)
              );
              const diag = new vscode.Diagnostic(
                range,
                `SOR Warning: '${edge.from}' used after yeide transfer to '${edge.to}'. Source may be invalid.`,
                vscode.DiagnosticSeverity.Warning
              );
              diag.source = 'kaula-sor';
              diagnostics.push(diag);
              break; // 只报告第一次使用
            }
          }
        }
      }
    }
  }

  // 检查 yeide 目标是否在之前未定义
  private checkYeideUndefinedTarget(diagnostics: vscode.Diagnostic[]): void {
    // 这里可以添加更复杂的检查，目前保持简单
  }

  private updateDecorations(document: vscode.TextDocument, cycle: string[] | null): void {
    const editor = vscode.window.visibleTextEditors.find(
      e => e.document.uri === document.uri
    );
    if (!editor) { return; }

    const decorations: vscode.DecorationOptions[] = [];

    // release 语句装饰
    for (const edge of this.dagChecker.getEdges()) {
      const line = editor.document.lineAt(edge.line);
      const range = new vscode.Range(line.range.end, line.range.end);

      let message: string;
      let color: string;
      if (cycle) {
        message = `⚠ cycle`;
        color = '#F44747';
      } else {
        message = `→ ${edge.to.length} holder(s)`;
        color = '#4FC1FF';
      }

      decorations.push({
        range,
        renderOptions: {
          after: {
            contentText: message,
            color
          }
        }
      });
    }

    // yeide 语句装饰
    for (const edge of this.yeideEdges) {
      const line = editor.document.lineAt(edge.line);
      const range = new vscode.Range(line.range.end, line.range.end);
      decorations.push({
        range,
        renderOptions: {
          after: {
            contentText: `→ ${edge.to}`,
            color: '#73C991'
          }
        }
      });
    }

    // extract 语句装饰
    for (const edge of this.extractEdges) {
      const line = editor.document.lineAt(edge.line);
      const range = new vscode.Range(line.range.end, line.range.end);
      decorations.push({
        range,
        renderOptions: {
          after: {
            contentText: `→ ${edge.to}`,
            color: '#DCDCAA'
          }
        }
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  // Hover 提供
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    // 1. release 语句 hover
    const releaseRange = document.getWordRangeAtPosition(position, /release\s+\w+\s*->\s*\[[^\]]+\]/);
    if (releaseRange) {
      const text = document.getText(releaseRange);
      const match = text.match(/release\s+(\w+)\s*->\s*\[([^\]]+)\]/);
      if (match) {
        const source = match[1];
        const holders = match[2].split(',').map(h => h.trim());
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**Release DAG**\n\n`);
        md.appendMarkdown(`**Source:** \`${source}\`\n\n`);
        md.appendMarkdown(`**Holders:**\n`);
        for (const h of holders) {
          md.appendMarkdown(`- \`${h}\`\n`);
        }
        md.appendMarkdown(`\n**Status:** ${this.dagChecker.detectCycle() ? '❌ Cycle detected' : '✅ Valid DAG'}`);
        return new vscode.Hover(md, releaseRange);
      }
    }

    // 2. yeide 语句 hover
    const yeideRange = document.getWordRangeAtPosition(position, /yeide\s+\w+\s*->\s*\w+/);
    if (yeideRange) {
      const text = document.getText(yeideRange);
      const match = text.match(/yeide\s+(\w+)\s*->\s*(\w+)/);
      if (match) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**Yeide Transfer**\n\n`);
        md.appendMarkdown(`所有权从 \`${match[1]}\` 转移到 \`${match[2]}\`\n\n`);
        md.appendMarkdown(`转移后 \`${match[1]}\` 不再持有所有权`);
        return new vscode.Hover(md, yeideRange);
      }
    }

    // 3. extract 语句 hover
    const extractRange = document.getWordRangeAtPosition(position, /extract\s+\w+\s*\[[^\]]*\]\s*->\s*\w+/);
    if (extractRange) {
      const text = document.getText(extractRange);
      const match = text.match(/extract\s+(\w+)\s*\[([^\]]*)\]\s*->\s*(\w+)/);
      if (match) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**Extract**\n\n`);
        md.appendMarkdown(`从 \`${match[1]}[${match[2]}]\` 提取到 \`${match[3]}\`\n\n`);
        md.appendMarkdown(`提取后 \`${match[1]}\` 仍持有所有权`);
        return new vscode.Hover(md, extractRange);
      }
    }

    return undefined;
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
    this.decorationType.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
