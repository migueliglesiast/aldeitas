import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `room-${params.id}-${timestamp}.${extension}`;

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "public", "uploads", "rooms");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    // Get the highest position for this room's images
    const maxPosition = await prisma.image.aggregate({
      where: { listingId: params.id },
      _max: { position: true },
    });

    const position = (maxPosition._max.position ?? -1) + 1;

    // Save image record to database
    const imageUrl = `/uploads/rooms/${filename}`;
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


