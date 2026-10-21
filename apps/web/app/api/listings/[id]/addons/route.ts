import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listEnabledAddons, publicAddon } from "@/lib/addons";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id }, select: { hotelId: true, baseCurrency: true } });
  if (!listing?.hotelId) return NextResponse.json({ addons: [] });
  const addons = await listEnabledAddons(listing.hotelId);
  return NextResponse.json({ addons: addons.map(publicAddon) });
}
