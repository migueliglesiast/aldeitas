import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncBilingualDescription } from "@/lib/sync-bilingual-description";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateRoomSchema = z.object({
  description: z.string().optional().nullable(),
  guestsInBeds: z.number().int().min(0).optional().nullable(),
  guestsInBedsAndSofas: z.number().int().min(0).optional().nullable(),
  numberOfBeds: z.number().int().min(0).optional().nullable(),
  bedType: z.string().optional().nullable(),
  numberOfBathrooms: z.number().min(0).optional().nullable(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the room and verify user is a manager of its hotel
    const room = await prisma.listing.findUnique({
      where: { id: params.id },
      include: {
        hotel: {
          include: {
            managers: {
              where: { userId: user.id },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.hotel.managers.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const data = updateRoomSchema.parse(body);
    const bilingual = await syncBilingualDescription(data.description);

    const updated = await prisma.listing.update({
      where: { id: params.id },
      data: {
        description: bilingual.description,
        descriptionEn: bilingual.descriptionEn,
        descriptionEs: bilingual.descriptionEs,
        guestsInBeds: data.guestsInBeds,
        guestsInBedsAndSofas: data.guestsInBedsAndSofas,
        numberOfBeds: data.numberOfBeds,
        bedType: data.bedType,
        numberOfBathrooms: data.numberOfBathrooms,
      },
    });

    return NextResponse.json({ room: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("[admin/room] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


