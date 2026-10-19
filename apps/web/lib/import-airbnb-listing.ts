import type { Prisma } from "@prisma/client";
import {
  fetchListingPageHtml,
  scrapeListingDescription,
  scrapeListingImagesFromHtml,
  scrapeListingTitle,
} from "@/lib/airbnb";
import { resolveListingAirbnbId } from "@/lib/airbnb-listing-id";
import { isCloudStorageEnabled, mirrorRemoteImageUrls } from "@/lib/image-storage";
import { prisma } from "@/lib/prisma";
import { syncBilingualDescription } from "@/lib/sync-bilingual-description";

type ScrapedListing = {
  title: string | null;
  images: string[];
  description: string | null;
};

export type ImportedListing = {
  roomId: string;
  title: string;
  cover: string | null;
  photoCount: number;
  created: boolean;
};

export async function scrapeAirbnbListing(airbnbId: string): Promise<ScrapedListing> {
  const html = await fetchListingPageHtml(`https://www.airbnb.com/rooms/${airbnbId}`);
  return {
    title: scrapeListingTitle(html),
    images: scrapeListingImagesFromHtml(html),
    description: scrapeListingDescription(html),
  };
}

function words(text: string) {
  return new Set(
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2)
  );
}

/**
 * Links a room to its Airbnb listing and fills in what it is missing: photos
 * when it has none, and the description when it is empty.
 */
export async function fillListingFromAirbnb(listingId: string, airbnbId: string, scraped?: ScrapedListing) {
  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: listingId },
    select: { description: true, _count: { select: { images: true } } },
  });
  const content = scraped ?? (await scrapeAirbnbListing(airbnbId));

  let images: string[] = [];
  if (listing._count.images === 0 && content.images.length > 0) {
    images = isCloudStorageEnabled()
      ? await mirrorRemoteImageUrls(content.images, "rooms", `room-${listingId}`)
      : content.images;
  }
  const bilingual =
    !listing.description?.trim() && content.description
      ? await syncBilingualDescription(content.description)
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.listing.update({
      where: { id: listingId },
      data: {
        airbnbId,
        airbnbUrl: `https://www.airbnb.com/rooms/${airbnbId}`,
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

/**
 * Brings one Airbnb listing into the hotel: fills the room already linked to
 * it, else an empty room with a matching name, else a new room.
 */
export async function importAirbnbListingIntoHotel(hotelId: string, airbnbId: string): Promise<ImportedListing> {
  const rooms = await prisma.listing.findMany({
    where: { hotelId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      airbnbId: true,
      airbnbUrl: true,
      icalUrl: true,
      calendarSources: { select: { icalUrl: true } },
      _count: { select: { images: true } },
    },
  });
  const scraped = await scrapeAirbnbListing(airbnbId);
  const title = scraped.title ?? `Airbnb ${airbnbId}`;

  const linked = rooms.find((room) => resolveListingAirbnbId(room) === airbnbId);
  const titleWords = words(title);
  const sameName = rooms.find(
    (room) =>
      !resolveListingAirbnbId(room) &&
      room._count.images === 0 &&
      [...words(room.title)].some((word) => titleWords.has(word))
  );
  let target = linked ?? sameName;
  let created = false;
  if (!target) {
    const room = await prisma.listing.create({
      data: { hotelId, airbnbId, airbnbUrl: `https://www.airbnb.com/rooms/${airbnbId}`, title },
      select: { id: true, title: true },
    });
    target = { ...room, airbnbId, airbnbUrl: "", icalUrl: null, calendarSources: [], _count: { images: 0 } };
    created = true;
  }

  const filled = await fillListingFromAirbnb(target.id, airbnbId, scraped);
  const cover = await prisma.image.findFirst({
    where: { listingId: target.id },
    orderBy: { position: "asc" },
    select: { url: true },
  });
  return {
    roomId: target.id,
    title: target.title,
    cover: cover?.url ?? null,
    photoCount: filled.photoCount || target._count.images,
    created,
  };
}

/** Deletes a room that has never had a booking, along with its photos and calendar links. */
export async function deleteUnbookedListing(tx: Prisma.TransactionClient, listingId: string) {
  if ((await tx.booking.count({ where: { listingId } })) > 0) return false;
  await tx.image.deleteMany({ where: { listingId } });
  await tx.calendarSource.deleteMany({ where: { listingId } });
  await tx.listing.delete({ where: { id: listingId } });
  return true;
}
