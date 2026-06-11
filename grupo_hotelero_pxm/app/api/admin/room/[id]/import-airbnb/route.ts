import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { normalizeAirbnbListingUrl, scrapeListingContent } from "@/lib/airbnb";
import { prisma } from "@/lib/prisma";
import { syncBilingualDescription } from "@/lib/sync-bilingual-description";
import { z } from "zod";

export const dynamic = "force-dynamic";

const importSchema = z.object({
  airbnbUrl: z.string().min(1),
  replaceExisting: z.boolean().optional().default(true),
  importPhotos: z.boolean().optional().default(true),
  importDescription: z.boolean().optional().default(false),
});

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

    const body = await req.json();
    const { airbnbUrl, replaceExisting, importPhotos, importDescription } =
      importSchema.parse(body);

    if (!importPhotos && !importDescription) {
      return NextResponse.json(
        { error: "Select at least one item to import." },
        { status: 400 }
      );
    }

    const normalizedUrl = normalizeAirbnbListingUrl(airbnbUrl);
    const scraped = await scrapeListingContent(normalizedUrl);

    if (importPhotos && scraped.images.length === 0) {
      return NextResponse.json(
        { error: "No listing photos found on that Airbnb page." },
        { status: 422 }
      );
    }

    if (importDescription && !scraped.description) {
      return NextResponse.json(
        { error: "No listing description found on that Airbnb page." },
        { status: 422 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const bilingual =
        importDescription && scraped.description
          ? await syncBilingualDescription(scraped.description)
          : null;

      await tx.listing.update({
        where: { id: params.id },
        data: {
          airbnbUrl: scraped.airbnbUrl,
          ...(bilingual
            ? {
                description: bilingual.description,
                descriptionEn: bilingual.descriptionEn,
                descriptionEs: bilingual.descriptionEs,
              }
            : {}),
        },
      });

      let images = await tx.image.findMany({
        where: { listingId: params.id },
        orderBy: { position: "asc" },
      });

      if (importPhotos) {
        if (replaceExisting) {
          await tx.image.deleteMany({ where: { listingId: params.id } });
        }

        const startPosition = replaceExisting
          ? 0
          : ((await tx.image.aggregate({
              where: { listingId: params.id },
              _max: { position: true },
            }))._max.position ?? -1) + 1;

        await tx.image.createMany({
          data: scraped.images.map((url, index) => ({
            listingId: params.id,
            url,
            position: startPosition + index,
          })),
        });

        images = await tx.image.findMany({
          where: { listingId: params.id },
          orderBy: { position: "asc" },
        });
      }

      return { images };
    });

    return NextResponse.json({
      airbnbUrl: scraped.airbnbUrl,
      photoCount: importPhotos ? scraped.images.length : 0,
      description: importDescription ? scraped.description ?? undefined : undefined,
      images: importPhotos ? result.images : undefined,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    const message =
      typeof error?.message === "string" ? error.message : "Failed to import from Airbnb";
    console.error("[admin/room/import-airbnb] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
