import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { duplicateImageFile } from "@/lib/admin-image-files";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sourceType: z.enum(["hotel", "room"]),
  sourceId: z.string(),
  imageIds: z.array(z.string()).min(1),
  destinationType: z.enum(["hotel", "room"]),
  destinationId: z.string(),
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

    const { sourceType, sourceId, imageIds, destinationType, destinationId } = parsed.data;

    if (sourceType === "hotel" && sourceId !== params.id) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    if (destinationType === "hotel" && destinationId !== params.id) {
      return NextResponse.json({ error: "Invalid destination" }, { status: 400 });
    }

    if (sourceType === destinationType && sourceId === destinationId) {
      return NextResponse.json({ error: "Source and destination must differ" }, { status: 400 });
    }

    let sourceImages: Array<{ id: string; url: string }> = [];

    if (sourceType === "hotel") {
      sourceImages = await prisma.hotelImage.findMany({
        where: { hotelId: params.id, id: { in: imageIds } },
        select: { id: true, url: true },
      });
    } else {
      const room = await prisma.listing.findFirst({
        where: { id: sourceId, hotelId: params.id },
      });

      if (!room) {
        return NextResponse.json({ error: "Invalid source room" }, { status: 400 });
      }

      sourceImages = await prisma.image.findMany({
        where: { listingId: sourceId, id: { in: imageIds } },
        select: { id: true, url: true },
      });
    }

    if (sourceImages.length !== imageIds.length) {
      return NextResponse.json({ error: "One or more images were not found" }, { status: 404 });
    }

    if (destinationType === "room") {
      const destinationRoom = await prisma.listing.findFirst({
        where: { id: destinationId, hotelId: params.id },
      });

      if (!destinationRoom) {
        return NextResponse.json({ error: "Invalid destination room" }, { status: 400 });
      }
    }

    const copiedImages = [];

    if (destinationType === "hotel") {
      let nextPosition =
        ((
          await prisma.hotelImage.aggregate({
            where: { hotelId: params.id },
            _max: { position: true },
          })
        )._max.position ?? -1) + 1;

      for (const sourceImage of sourceImages) {
        const url = await duplicateImageFile(sourceImage.url, "hotel", params.id);
        const image = await prisma.hotelImage.create({
          data: {
            hotelId: params.id,
            url,
            position: nextPosition,
          },
        });
        copiedImages.push(image);
        nextPosition += 1;
      }
    } else {
      let nextPosition =
        ((
          await prisma.image.aggregate({
            where: { listingId: destinationId },
            _max: { position: true },
          })
        )._max.position ?? -1) + 1;

      for (const sourceImage of sourceImages) {
        const url = await duplicateImageFile(sourceImage.url, "room", destinationId);
        const image = await prisma.image.create({
          data: {
            listingId: destinationId,
            url,
            position: nextPosition,
          },
        });
        copiedImages.push(image);
        nextPosition += 1;
      }
    }

    return NextResponse.json({
      copiedCount: copiedImages.length,
      images: copiedImages,
    });
  } catch (error: any) {
    console.error("[admin/hotel/images/copy]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
