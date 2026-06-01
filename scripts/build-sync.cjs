// Simulates what the VS Code extension does: walks a project,
// parses imports, builds a sync payload using the shared parser.
const fs = require("node:fs");
const path = require("node:path");
const {
  detectLanguage,
  hashContent,
  parseImports,
  resolveImport,
} = require("@kgv/shared/parsers");

const root = process.argv[2];
if (!root) {
  console.error("usage: node build-sync.cjs <root>");
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const allFiles = walk(root);
const knownPaths = new Set(
  allFiles.map((f) => path.relative(root, f).split(path.sep).join("/"))
);

const sync = {
  projectId: process.argv[3],
  files: allFiles.map((abs) => {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    const content = fs.readFileSync(abs, "utf8");
    const language = detectLanguage(rel);
    const rawImports = parseImports(content, language);
    const imports = rawImports.map((imp) => {
      const resolved = resolveImport(rel, imp.raw, language, knownPaths);
      return { ...imp, resolved };
    });
    return { path: rel, language, hash: hashContent(content), imports };
  }),
};

process.stdout.write(JSON.stringify(sync));
