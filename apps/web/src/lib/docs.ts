import type { DocumentType, GraphLink, GraphNode } from "@kgv/shared";
import type { GraphStats } from "./graph";

export interface DocContext {
  projectName: string;
  nodes: GraphNode[];
  links: GraphLink[];
  stats: GraphStats;
}

const dateStamp = () => new Date().toISOString().split("T")[0];

function heading(text: string, level = 2): string {
  return `${"#".repeat(level)} ${text}\n\n`;
}

function list(items: string[]): string {
  if (items.length === 0) return "_(none)_\n\n";
  return items.map((i) => `- ${i}`).join("\n") + "\n\n";
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "_(no data)_\n\n";
  const sep = headers.map(() => "---");
  const head = `| ${headers.join(" | ")} |`;
  const divider = `| ${sep.join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${divider}\n${body}\n\n`;
}

function languageBreakdown(stats: GraphStats): string {
  const rows = Object.entries(stats.languageCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => [lang, String(count)]);
  return table(["Language", "Files"], rows);
}

function mostConnected(stats: GraphStats): string {
  const rows = stats.topConnected.map((n) => [
    n.path,
    String(n.degree),
  ]);
  return table(["File", "Degree"], rows);
}

export function generatePRD(ctx: DocContext): string {
  const { projectName, stats } = ctx;
  const md = `# Product Requirements Document — ${projectName}\n\n` +
    `_Generated: ${dateStamp()}. This is a stub. Wire an LLM provider to enrich with real product intent._\n\n` +
    heading("Overview") +
    `${projectName} consists of **${stats.nodeCount} files** across **${stats.componentCount} connected component(s)**. ` +
    `The codebase spans ${Object.keys(stats.languageCounts).length} language(s).\n\n` +
    heading("Goals") +
    list([
      "Document the current structure of the system",
      "Capture user-facing capabilities inferred from modules",
      "Establish a baseline for future vibecoding sessions",
    ]) +
    heading("Inferred Capabilities") +
    "Capabilities are derived from the largest connected components and most-connected files.\n\n" +
    mostConnected(stats) +
    heading("Language Footprint") +
    languageBreakdown(stats) +
    heading("Open Questions") +
    list([
      "Which module is the primary entry point?",
      "What is the public API surface?",
      "What is the deployment target?",
    ]) +
    heading("Next Steps") +
    list([
      "Review the most-connected files to identify core abstractions",
      "Annotate components with ownership and intent",
      "Hook an LLM provider to auto-narrate modules",
    ]);

  return md;
}

export function generateHLD(ctx: DocContext): string {
  const { projectName, nodes, links, stats } = ctx;
  const md = `# High Level Design — ${projectName}\n\n` +
    `_Generated: ${dateStamp()}. Stub document. Enhance with an LLM to add rationale._\n\n` +
    heading("Architecture Summary") +
    `The system is modeled as a **directed graph of file dependencies** with **${stats.nodeCount} nodes** and **${stats.edgeCount} edges**, ` +
    `decomposed into **${stats.componentCount} connected component(s)**. ` +
    `${stats.isolatedCount} file(s) are currently isolated (no inbound or outbound references within the tracked set).\n\n` +
    heading("Module Boundaries") +
    "Connected components are treated as candidate modules. The largest component is the system's core; smaller components are likely utilities, scripts, or experiments.\n\n" +
    languageBreakdown(stats) +
    heading("Key Files (by connection count)") +
    mostConnected(stats) +
    heading("Top of the Dependency Graph") +
    "Files with no incoming edges are likely entry points (CLI, server, app shell).\n\n" +
    table(
      ["File", "Language"],
      nodes
        .filter((n) => !links.some((l) => l.target === n.id))
        .slice(0, 20)
        .map((n) => [n.path, n.language ?? "unknown"]),
    ) +
    heading("Cross-Component Dependencies") +
    "If a file in one component references a file in another, consider promoting the reference to a shared package.\n\n" +
    heading("Risks & Smells") +
    list([
      `${stats.isolatedCount} isolated file(s) — possibly dead code or missing from the watched set`,
      "Circular dependencies are not visualized here; consider adding a `cycles` view",
      "Large components may need to be split along natural seams",
    ]) +
    heading("Next Steps") +
    list([
      "Group components into named modules",
      "Add layer enforcement (UI → service → data)",
      "Connect an LLM to summarize each component",
    ]);

  return md;
}

export function generateLLD(ctx: DocContext): string {
  const { projectName, nodes, links, stats } = ctx;
  const md = `# Low Level Design — ${projectName}\n\n` +
    `_Generated: ${dateStamp()}. Stub. Use this as a starting point and expand manually or via LLM._\n\n` +
    heading("File Catalog") +
    table(
      ["Path", "Language", "Out-edges", "In-edges"],
      nodes
        .map((n) => [
          n.path,
          n.language ?? "unknown",
          String(links.filter((l) => l.source === n.id).length),
          String(links.filter((l) => l.target === n.id).length),
        ])
        .sort((a, b) => Number(b[2]) + Number(b[3]) - (Number(a[2]) + Number(a[3])))
        .slice(0, 100),
    ) +
    heading("Hot Spots (refactor candidates)") +
    "Files with the highest in+out degree are the most coupled. Changes here ripple widely.\n\n" +
    mostConnected(stats) +
    heading("Leaf Files (likely pure utilities)") +
    "Files with no outgoing edges are leaf utilities — good candidates to be made stateless and pure.\n\n" +
    table(
      ["Path"],
      nodes
        .filter((n) => !links.some((l) => l.source === n.id))
        .slice(0, 50)
        .map((n) => [n.path]),
    ) +
    heading("Conventions to Add") +
    list([
      "Naming: keep file paths kebab-case or camelCase consistently",
      "Boundary: enforce a max out-degree per file (e.g. ≤ 10)",
      "Tests: colocate `*.test.ts` next to the file it covers",
    ]) +
    heading("Generated Hooks (for LLM enrichment)") +
    "```ts\n" +
    "// When wiring OpenAI / Anthropic:\n" +
    "async function enrichLLD(projectId: string, ctx: DocContext): Promise<string> {\n" +
    "  const prompt = buildPrompt(ctx);\n" +
    "  const out = await llm.complete(prompt);\n" +
    "  return out;\n" +
    "}\n" +
    "```\n";

  return md;
}

export function generateDocument(type: DocumentType, ctx: DocContext): string {
  switch (type) {
    case "PRD":
      return generatePRD(ctx);
    case "HLD":
      return generateHLD(ctx);
    case "LLD":
      return generateLLD(ctx);
  }
}
