import * as path from "node:path";

const JS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const PY_EXTS = [".py"];
const GO_EXTS = [".go"];

const EXTS_BY_LANG: Record<string, string[]> = {
  typescript: JS_EXTS,
  javascript: JS_EXTS,
  python: PY_EXTS,
  go: GO_EXTS,
};

const PY_STDLIB = new Set([
  "os", "sys", "io", "re", "json", "math", "time", "datetime", "collections",
  "itertools", "functools", "pathlib", "typing", "asyncio", "subprocess",
  "threading", "multiprocessing", "socket", "http", "urllib", "logging",
  "unittest", "pytest", "argparse", "copy", "random", "string", "struct",
  "enum", "dataclasses", "abc", "contextlib", "weakref", "gc", "pprint",
  "csv", "configparser", "hashlib", "hmac", "secrets", "shutil", "tempfile",
  "glob", "fnmatch", "ast", "dis", "inspect", "importlib", "pkgutil",
]);

function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function candidateExtensions(language: string): string[] {
  return EXTS_BY_LANG[language] ?? [];
}

export function isBareSpecifier(spec: string): boolean {
  return !spec.startsWith(".") && !spec.startsWith("/") && !path.isAbsolute(spec);
}

export function isExternalSpecifier(spec: string, language: string): boolean {
  if (isBareSpecifier(spec)) {
    if (language === "python") {
      const head = spec.split(".")[0];
      if (head && PY_STDLIB.has(head)) return true;
      return false;
    }
    return true;
  }
  if (language === "python") {
    if (spec.startsWith(".") || spec.startsWith("/")) return false;
    if (spec.includes(".") || spec.includes("/")) return false;
    return true;
  }
  return false;
}

export function resolveImport(
  fromFilePath: string,
  spec: string,
  language: string,
  knownFiles: Set<string>,
): string | null {
  const normalized = normalize(spec);
  const fromDir = path.posix.dirname(normalize(fromFilePath));
  const base = fromDir === "." ? "" : fromDir;

  const candidates: string[] = [];
  if (language === "python" && isBareSpecifier(spec)) {
    const head = spec.split(".")[0];
    if (head) {
      candidates.push(head);
      for (const ext of PY_EXTS) candidates.push(`${head}${ext}`);
      candidates.push(`${head}/__init__.py`);
      if (base) {
        for (const ext of PY_EXTS) candidates.push(`${base}/${head}${ext}`);
        candidates.push(`${base}/${head}/__init__.py`);
      }
    }
  } else {
    const target = base ? `${base}/${normalized}` : normalized;
    candidates.push(target);
    for (const ext of candidateExtensions(language)) candidates.push(`${target}${ext}`);
    for (const ext of candidateExtensions(language)) candidates.push(`${target}/index${ext}`);
  }

  for (const c of candidates) {
    if (knownFiles.has(c)) return c;
  }
  return null;
}
