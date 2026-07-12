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
  private maps: SourceMap[] = [];

  loadSourceMap(mapPath: string): boolean {
    try {
      const data = fs.readFileSync(mapPath, 'utf-8');
      const map: SourceMap = JSON.parse(data);
      // normalize paths stored in the map
      map.target = path.normalize(map.target);
      map.source = path.normalize(map.source);
      this.maps.push(map);
      return true;
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.maps = [];
  }

  findMapForKLFile(klFilePath: string): SourceMap | null {
    const normalized = path.normalize(klFilePath);
    const dir = path.dirname(normalized);
    const base = path.basename(normalized, '.kl');

    // search locations: sibling cache/, parent cache/ (up 3), workspace cache/
    const candidates: string[] = [];

    // 1. <dir>/cache/<base>.map.json
    candidates.push(path.join(dir, 'cache', base + '.map.json'));

    // 2. parent dirs cache/
    let searchDir = dir;
    for (let i = 0; i < 4; i++) {
      const parent = path.dirname(searchDir);
      if (parent === searchDir) break;
      candidates.push(path.join(parent, 'cache', base + '.map.json'));
      searchDir = parent;
    }

    // 3. workspace root cache/
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      candidates.push(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'cache', base + '.map.json'));
    }

    // 4. same dir as .kl file
    candidates.push(path.join(dir, base + '.map.json'));

    // 5. <base>.c.map.json in same dir
    candidates.push(path.join(dir, base + '.c.map.json'));

    for (const mapPath of candidates) {
      if (!fs.existsSync(mapPath)) continue;

      // check if already loaded
      let map = this.maps.find(m => path.normalize(m.target).includes(base + '.c'));
      if (!map) {
        this.loadSourceMap(mapPath);
        map = this.maps.find(m => {
          const t = path.normalize(m.target);
          return t.endsWith(base + '.c') && path.normalize(m.source) === normalized;
        });
      }
      if (map) return map;
    }

    return null;
  }

  findMapForCFile(cFilePath: string): SourceMap | null {
    const normalized = path.normalize(cFilePath);
    const dir = path.dirname(normalized);
    const base = path.basename(normalized, '.c');

    // check if already loaded
    let map = this.maps.find(m => path.normalize(m.target) === normalized);
    if (map) return map;

    // search locations
    const candidates: string[] = [];

    // 1. same dir
    candidates.push(path.join(dir, base + '.map.json'));

    // 2. <filename>.map.json
    candidates.push(normalized + '.map.json');

    // 3. sibling cache/
    candidates.push(path.join(dir, 'cache', base + '.map.json'));

    // 4. parent dirs cache/
    let searchDir = dir;
    for (let i = 0; i < 4; i++) {
      const parent = path.dirname(searchDir);
      if (parent === searchDir) break;
      candidates.push(path.join(parent, 'cache', base + '.map.json'));
      searchDir = parent;
    }

    // 5. workspace root cache/
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      candidates.push(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'cache', base + '.map.json'));
    }

    for (const mapPath of candidates) {
      if (!fs.existsSync(mapPath)) continue;
      this.loadSourceMap(mapPath);
      map = this.maps.find(m => path.normalize(m.target) === normalized);
      if (map) return map;
    }

    return null;
  }

  cToKL(cFilePath: string, cLine: number): vscode.Location | null {
    const map = this.findMapForCFile(cFilePath);
    if (!map) return null;

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
    if (!map) return null;

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
    if (fs.existsSync(fromCDir)) return fromCDir;
    return sourcePath;
  }

  private resolveCPath(targetPath: string, klFilePath: string): string {
    if (path.isAbsolute(targetPath) && fs.existsSync(targetPath)) {
      return targetPath;
    }
    const klDir = path.dirname(klFilePath);
    const fromKLDir = path.join(klDir, targetPath);
    if (fs.existsSync(fromKLDir)) return fromKLDir;
    return targetPath;
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
    return this.sourceMapProvider.cToKL(document.uri.fsPath, position.line + 1);
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
