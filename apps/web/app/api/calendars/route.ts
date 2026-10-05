import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { isSafeUrl } from "@/lib/safe-url";
import { getCurrentUser } from "@/lib/auth";
import { requireManagedListing } from "@/lib/admin-hotel-auth";

const schema = z.object({ 
  name: z.string().min(2), 
  icalUrl: z.string().url(),
  listingId: z.string().optional().nullable()
});

export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(() => null);
    const parsed = schema.safeParse(data);
    if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    const { name, icalUrl, listingId } = parsed.data;
    if (!listingId) {
      return NextResponse.json({ error: "Choose a room for this calendar" }, { status: 400 });
    }
    const access = await requireManagedListing(listingId);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!isSafeUrl(icalUrl)) {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }
    const existing = await prisma.calendarSource.findUnique({
      where: { icalUrl },
      select: { listing: { select: { hotel: { select: { managers: { where: { userId: access.user.id }, select: { id: true } } } } } } },
    });
    if (existing?.listing && existing.listing.hotel.managers.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const created = await prisma.calendarSource.upsert({
      where: { icalUrl },
      update: { name, listingId },
      create: { name, icalUrl, listingId },
    });
    return NextResponse.json(created);
  } catch (error) {
    console.error("[Calendars] Error saving calendar source:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const items = await prisma.calendarSource.findMany({
      where: { listing: { hotel: { managers: { some: { userId: user.id } } } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("[Calendars] Error listing calendar sources:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


