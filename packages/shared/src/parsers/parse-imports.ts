import type { ParsedImport } from "../types";

const JS_IMPORT_RE = /(?:^|\n)\s*(?:import\s+(?:[^'"`]+?\s+from\s+)?|export\s+(?:[^'"`]+?\s+from\s+)?)(['"`])([^'"`]+)\1/g;
const JS_REQUIRE_RE = /\brequire\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
const JS_DYNAMIC_RE = /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;

const PY_FROM_IMPORT_RE = /(?:^|\n)\s*from\s+([.\w\\/-]+)\s+import\s+/g;
const PY_IMPORT_RE = /(?:^|\n)\s*import\s+([.\w\\/-]+)(?:\s+as\s+\w+)?/g;

const GO_IMPORT_RE = /(?:^|\n)\s*import\s+(?:\(\s*([\s\S]*?)\s*\)|([\w./-]+))/g;
const GO_SINGLE_IMPORT_RE = /"([\w./-]+)"/g;

function pushImport(
  out: ParsedImport[],
  raw: string,
  type: ParsedImport["type"],
  line: number,
) {
  out.push({ raw, resolved: null, type, line });
}

export function parseImports(content: string, language: string): ParsedImport[] {
  switch (language) {
    case "javascript":
    case "typescript":
      return parseJsLike(content);
    case "python":
      return parsePython(content);
    case "go":
      return parseGo(content);
    default:
      return [];
  }
}

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function parseJsLike(content: string): ParsedImport[] {
  const out: ParsedImport[] = [];

  for (const match of content.matchAll(JS_IMPORT_RE)) {
    const spec = match[2];
    if (!spec) continue;
    pushImport(out, spec, "import", lineOf(content, match.index ?? 0));
  }
  for (const match of content.matchAll(JS_REQUIRE_RE)) {
    const spec = match[2];
    if (!spec) continue;
    pushImport(out, spec, "require", lineOf(content, match.index ?? 0));
  }
  for (const match of content.matchAll(JS_DYNAMIC_RE)) {
    const spec = match[2];
    if (!spec) continue;
    pushImport(out, spec, "dynamic", lineOf(content, match.index ?? 0));
  }

  return out;
}

function parsePython(content: string): ParsedImport[] {
  const out: ParsedImport[] = [];

  for (const match of content.matchAll(PY_FROM_IMPORT_RE)) {
    const spec = match[1];
    if (!spec) continue;
    pushImport(out, spec, "import", lineOf(content, match.index ?? 0));
  }
  for (const match of content.matchAll(PY_IMPORT_RE)) {
    const spec = match[1];
    if (!spec) continue;
    pushImport(out, spec, "import", lineOf(content, match.index ?? 0));
  }

  return out;
}

function parseGo(content: string): ParsedImport[] {
  const out: ParsedImport[] = [];

  for (const match of content.matchAll(GO_IMPORT_RE)) {
    const block = match[1];
    if (block) {
      for (const inner of block.matchAll(GO_SINGLE_IMPORT_RE)) {
        const spec = inner[1];
        if (!spec) continue;
        pushImport(out, spec, "import", lineOf(content, match.index ?? 0));
      }
    }
    const single = match[2];
    if (single) {
      pushImport(out, single, "import", lineOf(content, match.index ?? 0));
    }
  }

  return out;
}
