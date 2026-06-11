import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  imageIds: z.array(z.string()).min(1),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotelManager = await prisma.hotelManager.findFirst({
      where: {
        userId: user.id,
        hotelId: params.id,
      },
    });

    if (!hotelManager) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { imageIds } = parsed.data;
    const uniqueIds = new Set(imageIds);
    if (uniqueIds.size !== imageIds.length) {
      return NextResponse.json({ error: "Duplicate image IDs provided" }, { status: 400 });
    }

    const existingImages = await prisma.hotelImage.findMany({
      where: { hotelId: params.id },
      select: { id: true },
    });

    if (existingImages.length !== imageIds.length) {
      return NextResponse.json(
        { error: "Image order must include all hotel images" },
        { status: 400 }
      );
    }

    const existingIds = new Set(existingImages.map((image) => image.id));
    if (!imageIds.every((id) => existingIds.has(id))) {
      return NextResponse.json({ error: "Invalid image IDs provided" }, { status: 400 });
    }

    const images = await prisma.$transaction(
      imageIds.map((id, position) =>
        prisma.hotelImage.update({
          where: { id },
          data: { position },
        })
      )
    );

    return NextResponse.json({
      images: images.sort((a, b) => a.position - b.position),
    });
  } catch (error: any) {
    console.error("[admin/hotel/image/reorder]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
