const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".pyi": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".c": "c",
  ".h": "c",
  ".hpp": "cpp",
  ".vue": "vue",
  ".svelte": "svelte",
};

const LANG_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  javascript: "#f7df1e",
  python: "#3776ab",
  go: "#00add8",
  rust: "#dea584",
  java: "#b07219",
  kotlin: "#a97bff",
  swift: "#ffac45",
  ruby: "#cc342d",
  php: "#4f5d95",
  csharp: "#178600",
  cpp: "#f34b7d",
  c: "#555555",
  vue: "#42b883",
  svelte: "#ff3e00",
  unknown: "#94a3b8",
};

export function detectLanguage(filePath: string): string {
  const idx = filePath.lastIndexOf(".");
  if (idx === -1) return "unknown";
  const ext = filePath.slice(idx).toLowerCase();
  return EXT_TO_LANG[ext] ?? "unknown";
}

export function languageColor(lang: string): string {
  return LANG_COLORS[lang] ?? LANG_COLORS.unknown;
}
