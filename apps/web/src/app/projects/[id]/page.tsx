import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeStats, connectedComponents } from "@/lib/graph";
import { ProjectView } from "@/components/project-view";
import type { GraphLink, GraphNode } from "@kgv/shared";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: Props) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { files: true },
  });
  if (!project) notFound();

  const fileIds = project.files.map((f) => f.id);
  const edges = await prisma.edge.findMany({
    where: { fromId: { in: fileIds } },
  });

  const nodes: GraphNode[] = project.files.map((f) => ({
    id: f.id,
    path: f.path,
    language: f.language,
  }));
  const links: GraphLink[] = edges.map((e) => ({
    id: e.id,
    source: e.fromId,
    target: e.toId,
    type: e.type as GraphLink["type"],
  }));

  const components = connectedComponents(nodes, links);
  const stats = computeStats(nodes, links);

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Link>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="font-semibold leading-none">{project.name}</h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {project.path}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{stats.nodeCount} files</span>
          <span>·</span>
          <span>{stats.edgeCount} refs</span>
          <span>·</span>
          <span>{stats.componentCount} components</span>
        </div>
      </header>
      <ProjectView
        projectId={project.id}
        initialNodes={nodes}
        initialLinks={links}
        initialStats={stats}
        initialComponents={components}
      />
    </main>
  );
}
