import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, checkToken, notFound, unauthorized } from "@/lib/api";
import { resolveImport } from "@kgv/shared/parsers";
import type { SyncRequest, SyncFileInput } from "@kgv/shared";

interface Params {
  params: { id: string };
}

export async function POST(req: Request, { params }: Params) {
  if (!checkToken(req)) return unauthorized();

  let body: SyncRequest;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }
  if (!body.projectId || body.projectId !== params.id) {
    return badRequest("projectId mismatch");
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
  });
  if (!project) return notFound("project");

  const existingFiles = await prisma.file.findMany({
    where: { projectId: params.id },
    select: { id: true, path: true, language: true },
  });
  const knownPaths = new Set(existingFiles.map((f) => f.path));
  const knownPathToId = new Map(existingFiles.map((f) => [f.path, f.id]));

  for (const file of body.files) {
    knownPaths.add(file.path);
    knownPathToId.set(file.path, file.path);
  }

  const stats = {
    filesUpserted: 0,
    filesDeleted: 0,
    edgesCreated: 0,
    edgesDeleted: 0,
  };

  await prisma.$transaction(async (tx) => {
    if (body.deletedPaths && body.deletedPaths.length > 0) {
      const result = await tx.file.deleteMany({
        where: { projectId: params.id, path: { in: body.deletedPaths } },
      });
      stats.filesDeleted = result.count;
    }

    for (const input of body.files) {
      await tx.file.upsert({
        where: {
          projectId_path: { projectId: params.id, path: input.path },
        },
        create: {
          projectId: params.id,
          path: input.path,
          language: input.language,
          hash: input.hash,
        },
        update: {
          language: input.language,
          hash: input.hash,
        },
      });
      stats.filesUpserted += 1;

      await tx.edge.deleteMany({ where: { from: { path: input.path, projectId: params.id } } });
      stats.edgesDeleted += 1;
    }

    const freshFiles = await tx.file.findMany({
      where: { projectId: params.id },
      select: { id: true, path: true, language: true },
    });
    const pathToId = new Map(freshFiles.map((f) => [f.path, f.id]));
    const allPaths = new Set(freshFiles.map((f) => f.path));

    for (const input of body.files) {
      const fromFile = freshFiles.find((f) => f.path === input.path);
      if (!fromFile) continue;
      const fromId = fromFile.id;
      const seenTargets = new Set<string>();

      for (const imp of input.imports) {
        const resolved = resolveImport(
          input.path,
          imp.raw,
          input.language,
          allPaths,
        );
        if (!resolved) continue;
        const toId = pathToId.get(resolved);
        if (!toId || toId === fromId) continue;
        const key = `${toId}|${imp.type}`;
        if (seenTargets.has(key)) continue;
        seenTargets.add(key);

        try {
          await tx.edge.create({
            data: { fromId, toId, type: imp.type },
          });
          stats.edgesCreated += 1;
        } catch {
        }
      }
    }
  });

  return NextResponse.json({ ok: true, stats });
}
