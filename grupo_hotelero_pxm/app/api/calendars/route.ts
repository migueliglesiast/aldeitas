import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ 
  name: z.string().min(2), 
  icalUrl: z.string().url(),
  listingId: z.string().optional().nullable()
});

export async function POST(req: NextRequest) {
  const data = await req.json();
  const parsed = schema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { name, icalUrl, listingId } = parsed.data;
  const created = await prisma.calendarSource.upsert({
    where: { icalUrl },
    update: { name, listingId: listingId || null },
    create: { name, icalUrl, listingId: listingId || null },
  });
  return NextResponse.json(created);
}

export async function GET() {
  const items = await prisma.calendarSource.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(items);
}


