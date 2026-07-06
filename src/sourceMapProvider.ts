import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface SourceMapEntry {
  generated_line: number;
  source_file: string;
  source_line: number;
  source_column: number;
  kind?: string;
  symbol_name?: string;
}

interface SourceMap {
  version: number;
  source: string;
  target: string;
  entries: SourceMapEntry[];
}

export class SourceMapProvider {
  private sourceMaps: Map<string, SourceMap> = new Map();

  loadSourceMap(mapPath: string): boolean {
    try {
      const data = fs.readFileSync(mapPath, 'utf-8');
      const map: SourceMap = JSON.parse(data);
      this.sourceMaps.set(map.target, map);
      return true;
    } catch {
      return false;
    }
  }

  findMapForCFile(cFilePath: string): SourceMap | null {
    const normalized = path.normalize(cFilePath);
    
    if (this.sourceMaps.has(normalized)) {
      return this.sourceMaps.get(normalized)!;
    }

    const mapPath = normalized + '.map.json';
    if (fs.existsSync(mapPath)) {
      this.loadSourceMap(mapPath);
      return this.sourceMaps.get(normalized) || null;
    }

    const dir = path.dirname(normalized);
    const base = path.basename(normalized, '.c');
    const altMapPath = path.join(dir, base + '.map.json');
    if (fs.existsSync(altMapPath)) {
      this.loadSourceMap(altMapPath);
      return this.sourceMaps.get(normalized) || null;
    }

    const cacheDir = path.join(vscode.workspace.rootPath || '', 'cache');
    const cacheMapPath = path.join(cacheDir, base + '.map.json');
    if (fs.existsSync(cacheMapPath)) {
      this.loadSourceMap(cacheMapPath);
      const cachedC = path.join(cacheDir, base + '.c');
      return this.sourceMaps.get(cachedC) || null;
    }

    return null;
  }

  findMapForKLFile(klFilePath: string): SourceMap | null {
    const normalized = path.normalize(klFilePath);
    const dir = path.dirname(normalized);
    const base = path.basename(normalized, '.kl');

    const cacheDir = path.join(vscode.workspace.rootPath || '', 'cache');
    const mapPath = path.join(cacheDir, base + '.map.json');
    if (fs.existsSync(mapPath)) {
      this.loadSourceMap(mapPath);
      const map = this.sourceMaps.get(path.join(cacheDir, base + '.c'));
      if (map && map.source === normalized) {
        return map;
      }
    }

    const localMapPath = path.join(dir, base + '.c.map.json');
    if (fs.existsSync(localMapPath)) {
      this.loadSourceMap(localMapPath);
      const cPath = path.join(dir, base + '.c');
      return this.sourceMaps.get(cPath) || null;
    }

    return null;
  }

  cToKL(cFilePath: string, cLine: number): vscode.Location | null {
    const map = this.findMapForCFile(cFilePath);
    if (!map) { return null; }

    let best: SourceMapEntry | null = null;
    for (const entry of map.entries) {
      if (entry.generated_line <= cLine) {
        if (!best || entry.generated_line > best.generated_line) {
          best = entry;
        }
      }
    }

    if (best) {
      const sourcePath = this.resolveSourcePath(map.source, cFilePath);
      if (sourcePath && fs.existsSync(sourcePath)) {
        const pos = new vscode.Position(best.source_line - 1, Math.max(0, best.source_column - 1));
        return new vscode.Location(vscode.Uri.file(sourcePath), pos);
      }
    }
    return null;
  }

  klToC(klFilePath: string, klLine: number): vscode.Location | null {
    const map = this.findMapForKLFile(klFilePath);
    if (!map) { return null; }

    let best: SourceMapEntry | null = null;
    for (const entry of map.entries) {
      if (entry.source_line <= klLine) {
        if (!best || entry.source_line > best.source_line) {
          best = entry;
        }
      }
    }

    if (best) {
      const cPath = this.resolveCPath(map.target, klFilePath);
      if (cPath && fs.existsSync(cPath)) {
        const pos = new vscode.Position(best.generated_line - 1, 0);
        return new vscode.Location(vscode.Uri.file(cPath), pos);
      }
    }
    return null;
  }

  private resolveSourcePath(sourcePath: string, cFilePath: string): string {
    if (path.isAbsolute(sourcePath) && fs.existsSync(sourcePath)) {
      return sourcePath;
    }

    const cDir = path.dirname(cFilePath);
    const fromCDir = path.join(cDir, sourcePath);
    if (fs.existsSync(fromCDir)) {
      return fromCDir;
    }

    const workspacePath = path.join(vscode.workspace.rootPath || '', sourcePath);
    if (fs.existsSync(workspacePath)) {
      return workspacePath;
    }

    return sourcePath;
  }

  private resolveCPath(targetPath: string, klFilePath: string): string {
    if (path.isAbsolute(targetPath) && fs.existsSync(targetPath)) {
      return targetPath;
    }

    const klDir = path.dirname(klFilePath);
    const fromKLDir = path.join(klDir, targetPath);
    if (fs.existsSync(fromKLDir)) {
      return fromKLDir;
    }

    const cacheDir = path.join(vscode.workspace.rootPath || '', 'cache');
    const base = path.basename(klFilePath, '.kl');
    const cachedC = path.join(cacheDir, base + '.c');
    if (fs.existsSync(cachedC)) {
      return cachedC;
    }

    return targetPath;
  }

  clearCache(): void {
    this.sourceMaps.clear();
  }
}

export class CDefinitionProvider implements vscode.DefinitionProvider {
  private sourceMapProvider: SourceMapProvider;

  constructor(smp: SourceMapProvider) {
    this.sourceMapProvider = smp;
  }

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Definition | vscode.LocationLink[] | null {
    const cFilePath = document.uri.fsPath;
    const cLine = position.line + 1;

    const klLocation = this.sourceMapProvider.cToKL(cFilePath, cLine);
    if (klLocation) {
      return klLocation;
    }

    return null;
  }
}

export class KLDefinitionProvider implements vscode.DefinitionProvider {
  private sourceMapProvider: SourceMapProvider;

  constructor(smp: SourceMapProvider) {
    this.sourceMapProvider = smp;
  }

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Definition | vscode.LocationLink[] | null {
    return null;
  }
}
