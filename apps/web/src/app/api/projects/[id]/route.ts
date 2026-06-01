import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, checkToken, notFound, unauthorized } from "@/lib/api";
import {
  computeStats,
  connectedComponents,
} from "@/lib/graph";
import type { GraphLink, GraphNode, GraphPayload, ProjectDTO } from "@kgv/shared";

interface Params {
  params: { id: string };
}

export async function GET(req: Request, { params }: Params) {
  if (!checkToken(req)) return unauthorized();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      files: true,
      _count: { select: { files: true, documents: true } },
    },
  });
  if (!project) return notFound("project");

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

  const payload: GraphPayload = {
    nodes,
    links,
    connectedComponents: components,
  };

  const dto: ProjectDTO & {
    graph: GraphPayload;
    stats: typeof stats;
    documentCount: number;
  } = {
    id: project.id,
    name: project.name,
    path: project.path,
    createdAt: project.createdAt.toISOString(),
    fileCount: project._count.files,
    edgeCount: links.length,
    graph: payload,
    stats,
    documentCount: project._count.documents,
  };

  return NextResponse.json(dto);
}

export async function DELETE(req: Request, { params }: Params) {
  if (!checkToken(req)) return unauthorized();
  try {
    await prisma.project.delete({ where: { id: params.id } });
  } catch {
    return notFound("project");
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Params) {
  if (!checkToken(req)) return unauthorized();
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }
  if (!body.name) return badRequest("name required");
  const project = await prisma.project.update({
    where: { id: params.id },
    data: { name: body.name },
  });
  return NextResponse.json({
    id: project.id,
    name: project.name,
    path: project.path,
    createdAt: project.createdAt.toISOString(),
  });
}
