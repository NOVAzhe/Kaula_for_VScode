import * as vscode from 'vscode';

interface ReleaseEdge {
  from: string;
  to: string[];
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

const RELEASE_PATTERN = /release\s+([a-zA-Z_]\w*)\s*->\s*\[([^\]]+)\]/g;

export class SORDiagnosticsProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private dagChecker: DAGChecker;
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
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    // 解析所有 release 语句
    let match;
    const regex = new RegExp(RELEASE_PATTERN.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      const source = match[1];
      const holders = match[2].split(',').map(h => h.trim()).filter(h => h.length > 0);
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      this.dagChecker.addEdge(source, holders, startPos.line, range);
    }

    // 环检测
    const cycle = this.dagChecker.detectCycle();

    if (cycle) {
      // 有环 → Error
      const cycleStr = cycle.join(' → ');
      for (const edge of this.dagChecker.getEdges()) {
        const diag = new vscode.Diagnostic(
          edge.range,
          `Release cycle detected: ${cycleStr}`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'kaula-sor';
        diagnostics.push(diag);
      }
    } else {
      // 无环 → Information（为每个 release 语句添加信息提示）
      for (const edge of this.dagChecker.getEdges()) {
        const diag = new vscode.Diagnostic(
          edge.range,
          `DAG valid: ${edge.from} → {${edge.to.join(', ')}} (${edge.to.length} holders)`,
          vscode.DiagnosticSeverity.Information
        );
        diag.source = 'kaula-sor';
        diagnostics.push(diag);
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);

    // 更新 Decoration
    this.updateDecorations(document, cycle);
  }

  private updateDecorations(document: vscode.TextDocument, cycle: string[] | null): void {
    const editor = vscode.window.visibleTextEditors.find(
      e => e.document.uri === document.uri
    );
    if (!editor) { return; }

    const decorations: vscode.DecorationOptions[] = [];

    for (const edge of this.dagChecker.getEdges()) {
      const line = editor.document.lineAt(edge.line);
      const range = new vscode.Range(line.range.end, line.range.end);

      let message: string;
      if (cycle) {
        message = `⚠ CYCLE DETECTED`;
      } else {
        message = `→ DAG: ${edge.to.length} holders, no cycles`;
      }

      decorations.push({
        range,
        renderOptions: {
          after: {
            contentText: message,
            color: cycle ? '#F44747' : '#4FC1FF'
          }
        }
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  // Hover 提供
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    const wordRange = document.getWordRangeAtPosition(position, /release\s+\w+\s*->\s*\[[^\]]+\]/);
    if (!wordRange) { return undefined; }

    const text = document.getText(wordRange);
    const match = text.match(/release\s+(\w+)\s*->\s*\[([^\]]+)\]/);
    if (!match) { return undefined; }

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

    return new vscode.Hover(md, wordRange);
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
    this.decorationType.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
