import { scrapeListingContent } from "@/lib/airbnb";
import { isCloudStorageEnabled, mirrorRemoteImageUrls } from "@/lib/image-storage";
import { prisma } from "@/lib/prisma";
import { syncBilingualDescription } from "@/lib/sync-bilingual-description";

/**
 * Links a room to its Airbnb listing and fills in what it is missing: photos
 * when it has none, and the description when it is empty.
 */
export async function fillListingFromAirbnb(listingId: string, airbnbId: string) {
  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: listingId },
    select: { description: true, _count: { select: { images: true } } },
  });
  const scraped = await scrapeListingContent(`https://www.airbnb.com/rooms/${airbnbId}`);

  let images: string[] = [];
  if (listing._count.images === 0 && scraped.images.length > 0) {
    images = isCloudStorageEnabled()
      ? await mirrorRemoteImageUrls(scraped.images, "rooms", `room-${listingId}`)
      : scraped.images;
  }
  const bilingual =
    !listing.description?.trim() && scraped.description
      ? await syncBilingualDescription(scraped.description)
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.listing.update({
      where: { id: listingId },
      data: {
        airbnbId,
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
    if (images.length > 0) {
      await tx.image.createMany({
        data: images.map((url, position) => ({ listingId, url, position })),
      });
    }
  });

  return { photoCount: images.length, description: Boolean(bilingual) };
}
