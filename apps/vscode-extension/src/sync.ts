import * as vscode from "vscode";
import * as path from "node:path";
import {
  detectLanguage,
  hashContent,
  parseImports,
} from "@kgv/shared/parsers";
import type { ParsedFile } from "@kgv/shared";
import type { ApiClient } from "./api-client";

let debounceTimer: NodeJS.Timeout | null = null;
let watcherDisposable: vscode.FileSystemWatcher | null = null;
let pendingChanges = new Set<string>();
let pendingDeletes = new Set<string>();
let knownProject: { id: string; path: string } | null = null;

const MAX_FILE_BYTES = () =>
  (vscode.workspace.getConfiguration("kgv").get<number>("maxFileSizeKb") ?? 512) *
  1024;

const IGNORE_GLOBS = () =>
  vscode.workspace
    .getConfiguration("kgv")
    .get<string[]>("ignore") ?? [];

function shouldIgnore(absolutePath: string): boolean {
  const patterns = IGNORE_GLOBS();
  const normalized = absolutePath.replace(/\\/g, "/");
  for (const pattern of patterns) {
    if (pattern.includes("**")) {
      const re = new RegExp(
        "^" +
          pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*\*/g, ".*")
            .replace(/\*/g, "[^/]*"),
      );
      if (re.test(normalized)) return true;
    } else if (normalized.includes(pattern)) {
      return true;
    }
  }
  return false;
}

function toRelative(absolutePath: string, root: string): string {
  const rel = path.relative(root, absolutePath).split(path.sep).join("/");
  return rel;
}

export function setKnownProject(project: { id: string; path: string } | null) {
  knownProject = project;
}

export function getKnownProject() {
  return knownProject;
}

async function parseFile(
  absolutePath: string,
  root: string,
): Promise<ParsedFile | null> {
  if (shouldIgnore(absolutePath)) return null;

  const stat = await vscode.workspace.fs.stat(
    vscode.Uri.file(absolutePath),
  );
  if (stat.size > MAX_FILE_BYTES()) return null;

  const bytes = await vscode.workspace.fs.readFile(
    vscode.Uri.file(absolutePath),
  );
  const content = Buffer.from(bytes).toString("utf8");
  const rel = toRelative(absolutePath, root);
  const language = detectLanguage(rel);
  const imports = parseImports(content, language);

  return {
    path: rel,
    language,
    imports,
    hash: hashContent(content),
  };
}

export async function startWatching(
  context: vscode.ExtensionContext,
  client: ApiClient,
  debounceMs: () => number,
  statusBar: vscode.StatusBarItem,
) {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    return;
  }
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;

  watcherDisposable = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(root, "**/*"),
  );

  const onChange = (uri: vscode.Uri) => {
    if (uri.fsPath.endsWith(".db") || uri.fsPath.includes("/.git/")) return;
    if (shouldIgnore(uri.fsPath)) {
      pendingDeletes.add(uri.fsPath);
      pendingChanges.delete(uri.fsPath);
    } else {
      pendingChanges.add(uri.fsPath);
      pendingDeletes.delete(uri.fsPath);
    }
    scheduleFlush(client, root, debounceMs, statusBar);
  };

  const onCreate = (uri: vscode.Uri) => onChange(uri);
  const onDelete = (uri: vscode.Uri) => {
    pendingDeletes.add(uri.fsPath);
    pendingChanges.delete(uri.fsPath);
    scheduleFlush(client, root, debounceMs, statusBar);
  };

  watcherDisposable.onDidChange(onChange);
  watcherDisposable.onDidCreate(onCreate);
  watcherDisposable.onDidDelete(onDelete);

  context.subscriptions.push(watcherDisposable);
}

function scheduleFlush(
  client: ApiClient,
  root: string,
  debounceMs: () => number,
  statusBar: vscode.StatusBarItem,
) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(
    () => flush(client, root, statusBar),
    debounceMs(),
  );
}

async function flush(
  client: ApiClient,
  root: string,
  statusBar: vscode.StatusBarItem,
) {
  const project = knownProject;
  if (!project || project.path !== root) {
    statusBar.text = "$(graph) KG: register workspace first";
    statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
    return;
  }

  const changes = Array.from(pendingChanges);
  const deletes = Array.from(pendingDeletes);
  pendingChanges.clear();
  pendingDeletes.clear();

  if (changes.length === 0 && deletes.length === 0) return;

  const files: Awaited<ReturnType<typeof parseFile>>[] = [];
  for (const abs of changes) {
    try {
      const parsed = await parseFile(abs, root);
      if (parsed) files.push(parsed);
    } catch (err) {
      console.warn("[kgv] parse failed:", abs, err);
    }
  }

  const deletedPaths = deletes
    .map((d) => toRelative(d, root))
    .filter((p) => p && !p.startsWith(".."));

  const validFiles = files.filter((f): f is NonNullable<typeof f> => f !== null);

  statusBar.text = `$(sync~spin) KG: syncing ${validFiles.length} files...`;
  try {
    const result = await client.syncFiles(
      project.id,
      validFiles,
      deletedPaths,
    );
    statusBar.text = `$(graph) KG: ${result.stats.filesUpserted}↑ ${result.stats.filesDeleted}↓ ${result.stats.edgesCreated}→`;
    statusBar.backgroundColor = undefined;
    statusBar.show();
  } catch (err) {
    statusBar.text = `$(alert) KG: sync failed`;
    statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
    statusBar.show();
    vscode.window.showErrorMessage(
      `Knowledge Graph sync failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function stopWatching() {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (watcherDisposable) {
    watcherDisposable.dispose();
    watcherDisposable = null;
  }
}

export async function syncAll(
  client: ApiClient,
  statusBar: vscode.StatusBarItem,
) {
  if (!vscode.workspace.workspaceFolders) return;
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  statusBar.text = "$(sync~spin) KG: full sync...";
  try {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(root, "**/*"),
    );
    const parsed: Awaited<ReturnType<typeof parseFile>>[] = [];
    for (const f of files) {
      const p = await parseFile(f.fsPath, root);
      if (p) parsed.push(p);
    }
    const project = knownProject;
    if (!project) throw new Error("no project registered");
    const valid = parsed.filter((f): f is NonNullable<typeof f> => f !== null);
    const result = await client.syncFiles(project.id, valid, []);
    statusBar.text = `$(graph) KG: ${result.stats.filesUpserted} files synced`;
    vscode.window.showInformationMessage(
      `Knowledge Graph: synced ${result.stats.filesUpserted} files, ${result.stats.edgesCreated} edges.`,
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      `Knowledge Graph full sync failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    statusBar.text = "$(alert) KG: sync failed";
  }
}
