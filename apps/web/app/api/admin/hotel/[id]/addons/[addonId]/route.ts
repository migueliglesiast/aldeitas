import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { addonPatchSchema } from "@/lib/addon-admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; addonId: string }> };

async function findAddon(hotelId: string, addonId: string) {
  return prisma.hotelAddon.findFirst({ where: { id: addonId, hotelId } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, addonId } = await params;
  const auth = await requireHotelManager(id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await findAddon(id, addonId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = addonPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const addon = await prisma.hotelAddon.update({ where: { id: addonId }, data: parsed.data });
  return NextResponse.json({ addon });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, addonId } = await params;
  const auth = await requireHotelManager(id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await findAddon(id, addonId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sold = await prisma.bookingAddon.count({ where: { addonId } });
  if (sold > 0) {
    const addon = await prisma.hotelAddon.update({ where: { id: addonId }, data: { enabled: false } });
    return NextResponse.json({ addon, archived: true });
  }
  await prisma.hotelAddon.delete({ where: { id: addonId } });
  return NextResponse.json({ deleted: true });
}
