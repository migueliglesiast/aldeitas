import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { join } from "path";
import { unlink } from "fs/promises";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the image and verify it belongs to a room in a hotel the user manages
    const image = await prisma.image.findUnique({
      where: { id: params.imageId },
      include: {
        listing: {
          include: {
            hotel: {
              include: {
                managers: {
                  where: { userId: user.id },
                },
              },
            },
          },
        },
      },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    if (image.listing.hotel.managers.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete file from filesystem
    try {
      const filepath = join(process.cwd(), "public", image.url);
      await unlink(filepath);
    } catch (fsError) {
      // File might not exist, continue with database deletion
      console.warn("Could not delete file:", fsError);
    }

    // Delete from database
    await prisma.image.delete({
      where: { id: params.imageId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[admin/room/image] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


