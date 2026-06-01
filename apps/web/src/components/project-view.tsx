"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
  BackgroundVariant,
} from "@xyflow/react";
import dagre from "dagre";
import {
  RefreshCw,
  Filter,
  X,
  Sparkles,
  FileText,
  Layers,
  Loader2,
  Code2,
  ArrowDown,
  ArrowRight,
} from "lucide-react";
import { Button, Badge, Input } from "@/components/ui";
import { languageColor } from "@kgv/shared";
import type { DocumentType, GraphLink, GraphNode } from "@kgv/shared";
import type { GraphStats } from "@/lib/graph";
import { DocPreviewDialog } from "@/components/doc-preview-dialog";

interface Props {
  projectId: string;
  initialNodes: GraphNode[];
  initialLinks: GraphLink[];
  initialStats: GraphStats;
  initialComponents: string[][];
}

type LayoutDirection = "LR" | "TB";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 56;

function layoutWithDagre(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 80 });

  for (const n of nodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });
}

export function ProjectView({
  projectId,
  initialNodes,
  initialLinks,
  initialStats,
  initialComponents,
}: Props) {
  const [rawNodes, setRawNodes] = useState<GraphNode[]>(initialNodes);
  const [rawLinks, setRawLinks] = useState<GraphLink[]>(initialLinks);
  const [components, setComponents] = useState(initialComponents);
  const [stats, setStats] = useState(initialStats);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<LayoutDirection>("LR");
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState<DocumentType | null>(null);
  const [docPreview, setDocPreview] = useState<{
    type: DocumentType;
    content: string;
  } | null>(null);

  const languageList = useMemo(
    () =>
      Object.entries(stats.languageCounts).sort(
        (a, b) => b[1] - a[1],
      ) as [string, number][],
    [stats.languageCounts],
  );

  const visibleNodes = useMemo(() => {
    let ns = rawNodes;
    if (languageFilter) ns = ns.filter((n) => (n.language ?? "unknown") === languageFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      ns = ns.filter((n) => n.path.toLowerCase().includes(q));
    }
    return ns;
  }, [rawNodes, languageFilter, search]);

  const visibleLinks = useMemo(
    () =>
      rawLinks.filter(
        (l) =>
          visibleNodes.some((n) => n.id === l.source) &&
          visibleNodes.some((n) => n.id === l.target),
      ),
    [rawLinks, visibleNodes],
  );

  const { flowNodes, flowEdges } = useMemo(() => {
    const nodes: Node[] = visibleNodes.map((n) => ({
      id: n.id,
      type: "default",
      data: {
        label: (
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: languageColor(n.language ?? "unknown") }}
            />
            <span className="truncate font-mono text-xs">{n.path}</span>
          </div>
        ),
        language: n.language,
        path: n.path,
      },
      position: { x: 0, y: 0 },
      style: {
        background: "hsl(var(--card))",
        color: "hsl(var(--card-foreground))",
        border: `1px solid ${
          selectedId === n.id
            ? "hsl(var(--primary))"
            : "hsl(var(--border))"
        }`,
        borderRadius: 8,
        padding: 8,
        width: NODE_WIDTH,
        fontSize: 12,
        boxShadow:
          selectedId === n.id
            ? "0 0 0 2px hsl(var(--primary) / 0.3)"
            : "none",
      },
    }));

    const edges: Edge[] = visibleLinks.map((l) => ({
      id: l.id,
      source: l.source,
      target: l.target,
      type: "smoothstep",
      animated: l.type === "dynamic",
      label: l.type,
      labelStyle: { fill: "hsl(var(--muted-foreground))", fontSize: 10 },
      labelBgStyle: { fill: "hsl(var(--background))" },
      labelBgPadding: [4, 2] as [number, number],
      style: {
        stroke:
          l.type === "import"
            ? "hsl(var(--primary))"
            : l.type === "require"
            ? "hsl(var(--accent-foreground))"
            : "hsl(var(--muted-foreground))",
        strokeWidth: 1.2,
        opacity: 0.7,
      },
    }));

    const laid = layoutWithDagre(nodes, edges, direction);
    return { flowNodes: laid, flowEdges: edges };
  }, [visibleNodes, visibleLinks, direction, selectedId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setRawNodes(data.graph.nodes);
        setRawLinks(data.graph.links);
        setComponents(data.graph.connectedComponents);
        setStats(data.stats);
      }
    } finally {
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    setSelectedId(node.id);
  }, []);

  const selectedNode = useMemo(
    () => rawNodes.find((n) => n.id === selectedId) ?? null,
    [rawNodes, selectedId],
  );
  const selectedOutgoing = useMemo(
    () =>
      selectedId
        ? rawLinks.filter((l) => l.source === selectedId)
        : [],
    [rawLinks, selectedId],
  );
  const selectedIncoming = useMemo(
    () =>
      selectedId
        ? rawLinks.filter((l) => l.target === selectedId)
        : [],
    [rawLinks, selectedId],
  );

  const generate = async (type: DocumentType) => {
    setGenerating(type);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/docs?type=${type}`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = await res.json();
        setDocPreview({ type, content: data.content });
      }
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-card/30">
        <div className="border-b p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Language</span>
            {languageFilter && (
              <button
                onClick={() => setLanguageFilter(null)}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
                clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {languageList.map(([lang, count]) => (
              <button
                key={lang}
                onClick={() =>
                  setLanguageFilter(languageFilter === lang ? null : lang)
                }
                className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors"
                style={{
                  background:
                    languageFilter === lang
                      ? "hsl(var(--accent))"
                      : "transparent",
                  borderColor:
                    languageFilter === lang
                      ? "hsl(var(--primary))"
                      : "hsl(var(--border))",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: languageColor(lang) }}
                />
                {lang}
                <span className="text-muted-foreground">{count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-b p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Layers className="h-4 w-4" />
            Connected Components
            <span className="text-xs text-muted-foreground">
              ({components.length})
            </span>
          </div>
          <div className="max-h-48 space-y-1 overflow-auto">
            {components.slice(0, 20).map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-accent"
              >
                <span className="truncate">
                  #{i + 1} · {c[0]?.split("/").pop() ?? "?"}
                </span>
                <Badge variant="secondary" className="ml-2 shrink-0">
                  {c.length}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="border-b p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Generate Docs
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["PRD", "HLD", "LLD"] as const).map((type) => (
              <Button
                key={type}
                variant="outline"
                size="sm"
                disabled={generating !== null}
                onClick={() => generate(type)}
              >
                {generating === type ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <FileText className="h-3 w-3" />
                )}
                {type}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Stub output. Hook an LLM to enrich.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {selectedNode ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Code2 className="h-4 w-4" />
                File Detail
              </div>
              <div className="rounded-md border bg-background p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background: languageColor(selectedNode.language ?? "unknown"),
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedNode.language ?? "unknown"}
                  </span>
                </div>
                <p className="break-all font-mono text-xs">
                  {selectedNode.path}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Imports ({selectedOutgoing.length})
                </p>
                <div className="space-y-0.5">
                  {selectedOutgoing.map((l) => {
                    const target = rawNodes.find((n) => n.id === l.target);
                    return (
                      <div
                        key={l.id}
                        className="rounded px-2 py-1 font-mono text-[11px] hover:bg-accent"
                      >
                        → {target?.path ?? l.target}
                      </div>
                    );
                  })}
                  {selectedOutgoing.length === 0 && (
                    <p className="px-2 text-[11px] text-muted-foreground">
                      (none)
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Imported by ({selectedIncoming.length})
                </p>
                <div className="space-y-0.5">
                  {selectedIncoming.map((l) => {
                    const source = rawNodes.find((n) => n.id === l.source);
                    return (
                      <div
                        key={l.id}
                        className="rounded px-2 py-1 font-mono text-[11px] hover:bg-accent"
                      >
                        ← {source?.path ?? l.source}
                      </div>
                    );
                  })}
                  {selectedIncoming.length === 0 && (
                    <p className="px-2 text-[11px] text-muted-foreground">
                      (none)
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Click a node to inspect its imports and dependents.</p>
              <div className="rounded-md border bg-background p-3 text-xs">
                <p className="mb-1 font-medium text-foreground">Stats</p>
                <p>Files: {stats.nodeCount}</p>
                <p>Edges: {stats.edgeCount}</p>
                <p>Components: {stats.componentCount}</p>
                <p>Isolated: {stats.isolatedCount}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="relative flex-1">
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <div className="flex items-center rounded-md border bg-card p-0.5">
            <button
              onClick={() => setDirection("LR")}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs"
              style={{
                background:
                  direction === "LR" ? "hsl(var(--accent))" : "transparent",
              }}
            >
              <ArrowRight className="h-3 w-3" />
              LR
            </button>
            <button
              onClick={() => setDirection("TB")}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs"
              style={{
                background:
                  direction === "TB" ? "hsl(var(--accent))" : "transparent",
              }}
            >
              <ArrowDown className="h-3 w-3" />
              TB
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodeClick={handleNodeClick}
          onPaneClick={() => setSelectedId(null)}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls className="!shadow-none" />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => {
              const lang = (n.data as { language?: string })?.language ?? "unknown";
              return languageColor(lang);
            }}
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
            }}
          />
        </ReactFlow>
      </div>

      {docPreview && (
        <DocPreviewDialog
          type={docPreview.type}
          content={docPreview.content}
          onClose={() => setDocPreview(null)}
        />
      )}
    </div>
  );
}
