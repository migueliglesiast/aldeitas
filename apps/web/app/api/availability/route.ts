import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchIcalBlocks } from "@/lib/airbnb";

export const dynamic = "force-static";

export async function GET() {
  // Disabled in static export; emit a static 405 JSON
  return NextResponse.json({ error: 'Not available in static export' }, { status: 405 });
}


