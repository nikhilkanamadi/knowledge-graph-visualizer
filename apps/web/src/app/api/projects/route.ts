import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, checkToken, unauthorized } from "@/lib/api";
import type { ProjectDTO } from "@kgv/shared";

export async function GET(req: Request) {
  if (!checkToken(req)) return unauthorized();
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { files: true } } },
  });

  const projectIds = projects.map((p) => p.id);
  const edgeCounts = await prisma.edge.groupBy({
    by: ["fromId"],
    where: { from: { projectId: { in: projectIds } } },
    _count: { _all: true },
  });
  const edgeByProject = new Map<string, number>();
  for (const row of edgeCounts) {
    const file = await prisma.file.findUnique({
      where: { id: row.fromId },
      select: { projectId: true },
    });
    if (file) {
      edgeByProject.set(
        file.projectId,
        (edgeByProject.get(file.projectId) ?? 0) + row._count._all,
      );
    }
  }

  const result: ProjectDTO[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    path: p.path,
    createdAt: p.createdAt.toISOString(),
    fileCount: p._count.files,
    edgeCount: edgeByProject.get(p.id) ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  if (!checkToken(req)) return unauthorized();
  let body: { name?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }
  if (!body.name || !body.path) return badRequest("name and path required");

  const existing = await prisma.project.findUnique({ where: { path: body.path } });
  if (existing) {
    return NextResponse.json({
      id: existing.id,
      name: existing.name,
      path: existing.path,
      createdAt: existing.createdAt.toISOString(),
    });
  }

  const project = await prisma.project.create({
    data: { name: body.name, path: body.path },
  });

  return NextResponse.json({
    id: project.id,
    name: project.name,
    path: project.path,
    createdAt: project.createdAt.toISOString(),
  });
}
