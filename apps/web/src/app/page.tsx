import Link from "next/link";
import { Activity, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { ProjectCard } from "@/components/project-card";
import { prisma } from "@/lib/db";
import type { ProjectDTO } from "@kgv/shared";

export const dynamic = "force-dynamic";

async function loadProjects(): Promise<ProjectDTO[]> {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { files: true } } },
  });

  const projectIds = projects.map((p) => p.id);
  const edges = await prisma.edge.findMany({
    where: { from: { projectId: { in: projectIds } } },
    select: { from: { select: { projectId: true } } },
  });
  const edgeCountByProject = new Map<string, number>();
  for (const e of edges) {
    const pid = e.from.projectId;
    edgeCountByProject.set(pid, (edgeCountByProject.get(pid) ?? 0) + 1);
  }

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    path: p.path,
    createdAt: p.createdAt.toISOString(),
    fileCount: p._count.files,
    edgeCount: edgeCountByProject.get(p.id) ?? 0,
  }));
}

export default async function HomePage() {
  const projects = await loadProjects();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Knowledge Graph</h1>
            <p className="text-sm text-muted-foreground">
              Visualize file dependencies across your projects
            </p>
          </div>
        </div>
        <NewProjectDialog />
      </header>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <FolderPlus className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="mb-1 text-lg font-medium">No projects yet</h2>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            Register a project path and point the VS Code extension at it to
            start tracking file references.
          </p>
          <NewProjectDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <ProjectCard project={p} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
