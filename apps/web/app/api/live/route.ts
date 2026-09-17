import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe — no database. Returns 200 when Node/Next is running. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    uptime: process.uptime(),
    nodeEnv: process.env.NODE_ENV || "undefined",
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
  });
}
