import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { addonInputSchema } from "@/lib/addon-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireHotelManager(id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const addons = await prisma.hotelAddon.findMany({
    where: { hotelId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ addons });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireHotelManager(id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = addonInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const addon = await prisma.hotelAddon.create({ data: { ...parsed.data, hotelId: id } });
  return NextResponse.json({ addon }, { status: 201 });
}
