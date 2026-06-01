import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkToken, notFound, unauthorized } from "@/lib/api";
import { computeStats } from "@/lib/graph";
import { generateDocument } from "@/lib/docs";
import type { DocumentType, GraphLink, GraphNode } from "@kgv/shared";

interface Params {
  params: { id: string };
}

const ALLOWED: DocumentType[] = ["PRD", "HLD", "LLD"];

export async function GET(req: Request, { params }: Params) {
  if (!checkToken(req)) return unauthorized();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { files: true, documents: true },
  });
  if (!project) return notFound("project");

  return NextResponse.json(
    project.documents.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      type: d.type,
      content: d.content,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  );
}

export async function POST(req: Request, { params }: Params) {
  if (!checkToken(req)) return unauthorized();
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as DocumentType | null;
  if (!type || !ALLOWED.includes(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { files: true },
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
  const stats = computeStats(nodes, links);

  const content = generateDocument(type, {
    projectName: project.name,
    nodes,
    links,
    stats,
  });

  const doc = await prisma.document.upsert({
    where: { projectId_type: { projectId: project.id, type } },
    create: { projectId: project.id, type, content },
    update: { content },
  });

  return NextResponse.json({
    id: doc.id,
    projectId: doc.projectId,
    type: doc.type,
    content: doc.content,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
}
