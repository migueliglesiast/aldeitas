import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteImageFile } from "@/lib/image-storage";

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

    const image = await prisma.hotelImage.findUnique({
      where: { id: params.imageId },
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

    await deleteImageFile(image.url);

    await prisma.hotelImage.delete({
      where: { id: params.imageId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[admin/hotel/image] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
