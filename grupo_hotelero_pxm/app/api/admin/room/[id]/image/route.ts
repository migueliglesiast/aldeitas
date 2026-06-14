import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage } from "@/lib/image-storage";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";

    const imageUrl = await saveUploadedImage(buffer, {
      folder: "rooms",
      filenameBase: `room-${params.id}-${timestamp}`,
      extension,
    });

    const maxPosition = await prisma.image.aggregate({
      where: { listingId: params.id },
      _max: { position: true },
    });

    const position = (maxPosition._max.position ?? -1) + 1;

    const image = await prisma.image.create({
      data: {
        listingId: params.id,
        url: imageUrl,
        position,
      },
    });

    return NextResponse.json({ image });
  } catch (error: any) {
    console.error("[admin/room/image] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
