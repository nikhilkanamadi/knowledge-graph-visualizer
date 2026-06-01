import { NextResponse } from "next/server";

export async function GET() {
  const vars = {
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL
      ? `set (${process.env.POSTGRES_PRISMA_URL.length} chars, starts: ${process.env.POSTGRES_PRISMA_URL.slice(0, 20)})`
      : "MISSING",
    POSTGRES_URL: process.env.POSTGRES_URL
      ? `set (${process.env.POSTGRES_URL.length} chars)`
      : "MISSING",
    KGV_API_TOKEN: process.env.KGV_API_TOKEN
      ? `set (${process.env.KGV_API_TOKEN.length} chars)`
      : "MISSING",
    NODE_ENV: process.env.NODE_ENV ?? "MISSING",
    VERCEL: process.env.VERCEL ?? "MISSING",
    VERCEL_ENV: process.env.VERCEL_ENV ?? "MISSING",
  };
  return NextResponse.json(vars);
}
