import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteImageFile } from "@/lib/admin-image-files";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sourceType: z.enum(["hotel", "room"]),
  sourceId: z.string(),
  imageIds: z.array(z.string()).min(1),
});

async function verifyHotelAccess(hotelId: string, userId: string) {
  return prisma.hotelManager.findFirst({
    where: { hotelId, userId },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await verifyHotelAccess(params.id, user.id);
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { sourceType, sourceId, imageIds } = parsed.data;

    if (sourceType === "hotel") {
      if (sourceId !== params.id) {
        return NextResponse.json({ error: "Invalid source" }, { status: 400 });
      }

      const images = await prisma.hotelImage.findMany({
        where: { hotelId: params.id, id: { in: imageIds } },
      });

      if (images.length !== imageIds.length) {
        return NextResponse.json({ error: "One or more images were not found" }, { status: 404 });
      }

      for (const image of images) {
        await deleteImageFile(image.url);
      }

      await prisma.hotelImage.deleteMany({
        where: { id: { in: imageIds } },
      });
    } else {
      const room = await prisma.listing.findFirst({
        where: { id: sourceId, hotelId: params.id },
      });

      if (!room) {
        return NextResponse.json({ error: "Invalid source room" }, { status: 400 });
      }

      const images = await prisma.image.findMany({
        where: { listingId: sourceId, id: { in: imageIds } },
      });

      if (images.length !== imageIds.length) {
        return NextResponse.json({ error: "One or more images were not found" }, { status: 404 });
      }

      for (const image of images) {
        await deleteImageFile(image.url);
      }

      await prisma.image.deleteMany({
        where: { id: { in: imageIds } },
      });
    }

    return NextResponse.json({ success: true, deletedCount: imageIds.length });
  } catch (error: any) {
    console.error("[admin/hotel/images/bulk-delete]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
