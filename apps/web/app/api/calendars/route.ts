import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { isSafeUrl } from "@/lib/safe-url";

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
    if (!isSafeUrl(icalUrl)) {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }
    const created = await prisma.calendarSource.upsert({
      where: { icalUrl },
      update: { name, listingId: listingId || null },
      create: { name, icalUrl, listingId: listingId || null },
    });
    return NextResponse.json(created);
  } catch (error) {
    console.error("[Calendars] Error saving calendar source:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const items = await prisma.calendarSource.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(items);
  } catch (error) {
    console.error("[Calendars] Error listing calendar sources:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


