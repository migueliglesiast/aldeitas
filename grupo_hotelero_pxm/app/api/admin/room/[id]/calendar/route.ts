import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function getManagedRoom(roomId: string, userId: string) {
  return prisma.listing.findUnique({
    where: { id: roomId },
    include: {
      hotel: {
        include: {
          managers: {
            where: { userId },
          },
        },
      },
      calendarSources: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

const createSchema = z.object({
  name: z.string().min(2).optional(),
  icalUrl: z.string().url(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const room = await getManagedRoom(params.id, user.id);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.hotel.managers.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json(room.calendarSources);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const room = await getManagedRoom(params.id, user.id);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.hotel.managers.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid calendar data" }, { status: 400 });
  }

  const { icalUrl } = parsed.data;
  const name = parsed.data.name?.trim() || `Airbnb - ${room.title}`;

  const created = await prisma.calendarSource.upsert({
    where: { icalUrl },
    update: { name, listingId: room.id },
    create: { name, icalUrl, listingId: room.id },
  });

  return NextResponse.json(created);
}
