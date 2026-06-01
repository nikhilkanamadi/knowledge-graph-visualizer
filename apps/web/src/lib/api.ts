import { NextResponse } from "next/server";

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function checkToken(req: Request): boolean {
  const expected = process.env.KGV_API_TOKEN;
  if (!expected) return true;
  const header = req.headers.get("authorization") ?? "";
  const provided =
    header.startsWith("Bearer ")
      ? header.slice(7)
      : req.headers.get("x-kgv-token") ?? "";
  return provided === expected;
}
