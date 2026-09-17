import { PrismaClient } from "@prisma/client";
import { scrapeListingImages } from "./airbnb";
import { isCloudStorageEnabled, mirrorRemoteImageUrls } from "./image-storage";

export type RoomImportSource = {
  roomTitle: string;
  airbnbUrl: string;
};

export type HotelImportConfig = {
  hotelName: string;
  rooms: RoomImportSource[];
};

export type ImportRoomImagesOptions = {
  configs: HotelImportConfig[];
  hotelFilter?: string;
  replaceExisting?: boolean;
  mirrorToCloud?: boolean;
  dryRun?: boolean;
  prisma?: PrismaClient;
};

export type ImportRoomImagesResult = {
  hotelName: string;
  roomTitle: string;
  imageCount: number;
  mirrored: boolean;
  airbnbUrl: string;
  skipped?: string;
};

export async function importRoomImages(
  options: ImportRoomImagesOptions
): Promise<ImportRoomImagesResult[]> {
  const prisma = options.prisma ?? new PrismaClient();
  const ownsClient = !options.prisma;
  const replaceExisting = options.replaceExisting ?? true;
  const mirrorToCloud = options.mirrorToCloud ?? isCloudStorageEnabled();
  const dryRun = options.dryRun ?? false;

  if (mirrorToCloud && !isCloudStorageEnabled()) {
    throw new Error(
      "mirrorToCloud requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET"
    );
  }

  const configs = options.hotelFilter
    ? options.configs.filter((config) =>
        config.hotelName.toLowerCase().includes(options.hotelFilter!.toLowerCase())
      )
    : options.configs;

  const results: ImportRoomImagesResult[] = [];
  const urlCache = new Map<string, string[]>();

  try {
    for (const config of configs) {
      const hotel = await prisma.hotel.findFirst({ where: { name: config.hotelName } });
      if (!hotel) {
        results.push({
          hotelName: config.hotelName,
          roomTitle: "*",
          imageCount: 0,
          mirrored: false,
          airbnbUrl: "",
          skipped: "Hotel not found",
        });
        continue;
      }

      for (const { roomTitle, airbnbUrl } of config.rooms) {
        const listing = await prisma.listing.findFirst({
          where: { hotelId: hotel.id, title: roomTitle },
        });

        if (!listing) {
          results.push({
            hotelName: config.hotelName,
            roomTitle,
            imageCount: 0,
            mirrored: false,
            airbnbUrl,
            skipped: "Room not found",
          });
          continue;
        }

        let urls = urlCache.get(airbnbUrl);
        if (!urls) {
          urls = await scrapeListingImages(airbnbUrl);
          urlCache.set(airbnbUrl, urls);
        }

        if (urls.length === 0) {
          results.push({
            hotelName: config.hotelName,
            roomTitle,
            imageCount: 0,
            mirrored: false,
            airbnbUrl,
            skipped: "No images scraped",
          });
          continue;
        }

        let finalUrls = urls;
        if (mirrorToCloud) {
          finalUrls = await mirrorRemoteImageUrls(urls, "rooms", `room-${listing.id}`);
        }

        if (!dryRun) {
          if (replaceExisting) {
            await prisma.image.deleteMany({ where: { listingId: listing.id } });
          }

          const startPosition = replaceExisting
            ? 0
            : ((await prisma.image.aggregate({
                where: { listingId: listing.id },
                _max: { position: true },
              }))._max.position ?? -1) + 1;

          await prisma.$transaction(
            finalUrls.map((url, index) =>
              prisma.image.create({
                data: {
                  listingId: listing.id,
                  url,
                  position: startPosition + index,
                },
              })
            )
          );

          await prisma.listing.update({
            where: { id: listing.id },
            data: { airbnbUrl },
          });
        }

        results.push({
          hotelName: config.hotelName,
          roomTitle,
          imageCount: finalUrls.length,
          mirrored: mirrorToCloud,
          airbnbUrl,
        });
      }
    }
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }

  return results;
}
