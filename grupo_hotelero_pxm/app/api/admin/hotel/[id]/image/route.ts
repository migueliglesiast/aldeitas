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

    // Verify user is a manager of this hotel
    const hotelManager = await prisma.hotelManager.findFirst({
      where: {
        userId: user.id,
        hotelId: params.id,
      },
    });

    if (!hotelManager) {
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
    const filename = `hotel-${params.id}-${timestamp}.${extension}`;

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "public", "uploads", "hotels");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    // Get the highest position for this hotel's images
    const maxPosition = await prisma.hotelImage.aggregate({
      where: { hotelId: params.id },
      _max: { position: true },
    });

    const position = (maxPosition._max.position ?? -1) + 1;

    // Save image record to database
    const imageUrl = `/uploads/hotels/${filename}`;
    const image = await prisma.hotelImage.create({
      data: {
        hotelId: params.id,
        url: imageUrl,
        position,
      },
    });

    return NextResponse.json({ image });
  } catch (error: any) {
    console.error("[admin/hotel/image] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; imageId?: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("imageId") || params.imageId;

    if (!imageId) {
      return NextResponse.json({ error: "Image ID required" }, { status: 400 });
    }

    // Get the image and verify it belongs to a hotel the user manages
    const image = await prisma.hotelImage.findUnique({
      where: { id: imageId },
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

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    if (image.hotel.managers.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete file from filesystem
    try {
      const filepath = join(process.cwd(), "public", image.url);
      const { unlink } = await import("fs/promises");
      await unlink(filepath);
    } catch (fsError) {
      // File might not exist, continue with database deletion
      console.warn("Could not delete file:", fsError);
    }

    // Delete from database
    await prisma.hotelImage.delete({
      where: { id: imageId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[admin/hotel/image] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


