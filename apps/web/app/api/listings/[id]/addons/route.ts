import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listOfferedAddons, publicAddon } from "@/lib/addons";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: string | null) {
  return value && DAY.test(value) ? new Date(value) : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id }, select: { hotelId: true } });
  if (!listing?.hotelId) return NextResponse.json({ addons: [] });
  const { searchParams } = new URL(req.url);
  const start = parseDay(searchParams.get("start"));
  const end = parseDay(searchParams.get("end"));
  const stay = start && end && end > start ? { start, end } : null;
  const addons = await listOfferedAddons(listing.hotelId, id, stay?.start ?? null, stay?.end ?? null);
  return NextResponse.json({ addons: addons.map(publicAddon) });
}
