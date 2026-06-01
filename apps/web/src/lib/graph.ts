import type { GraphLink, GraphNode } from "@kgv/shared";

export function buildAdjacency(
  nodes: GraphNode[],
  links: GraphLink[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const node of nodes) adj.set(node.id, new Set());
  for (const link of links) {
    if (!adj.has(link.source)) adj.set(link.source, new Set());
    if (!adj.has(link.target)) adj.set(link.target, new Set());
    adj.get(link.source)!.add(link.target);
    adj.get(link.target)!.add(link.source);
  }
  return adj;
}

export function connectedComponents(
  nodes: GraphNode[],
  links: GraphLink[],
): string[][] {
  const adj = buildAdjacency(nodes, links);
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const component: string[] = [];
    const stack = [node.id];
    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      const neighbors = adj.get(current);
      if (neighbors) {
        for (const next of neighbors) {
          if (!visited.has(next)) stack.push(next);
        }
      }
    }
    if (component.length > 0) components.push(component);
  }

  components.sort((a, b) => b.length - a.length);
  return components;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  componentCount: number;
  isolatedCount: number;
  languageCounts: Record<string, number>;
  topConnected: Array<{ id: string; path: string; degree: number }>;
}

export function computeStats(
  nodes: GraphNode[],
  links: GraphLink[],
): GraphStats {
  const degree = new Map<string, number>();
  const langCounts: Record<string, number> = {};

  for (const node of nodes) {
    degree.set(node.id, 0);
    const lang = node.language ?? "unknown";
    langCounts[lang] = (langCounts[lang] ?? 0) + 1;
  }

  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
  }

  const components = connectedComponents(nodes, links);
  const isolated = nodes.filter((n) => (degree.get(n.id) ?? 0) === 0).length;

  const topConnected = nodes
    .map((n) => ({ id: n.id, path: n.path, degree: degree.get(n.id) ?? 0 }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 10);

  return {
    nodeCount: nodes.length,
    edgeCount: links.length,
    componentCount: components.length,
    isolatedCount: isolated,
    languageCounts: langCounts,
    topConnected,
  };
}
