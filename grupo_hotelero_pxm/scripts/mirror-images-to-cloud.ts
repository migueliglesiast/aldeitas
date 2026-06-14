/**
 * Upload existing Image / HotelImage URLs to Cloudinary and update the database.
 *
 * Usage:
 *   npm run images:mirror-cloud
 *   npm run images:mirror-cloud -- --dry-run
 */
import { PrismaClient } from "@prisma/client";
import {
  isCloudStorageEnabled,
  mirrorRemoteImageUrls,
  saveUploadedImage,
  getImageExtension,
} from "../lib/image-storage";
import { readFile } from "fs/promises";
import { join } from "path";

const prisma = new PrismaClient();

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function mirrorUrl(url: string, folder: "hotels" | "rooms", prefix: string): Promise<string> {
  if (url.includes("res.cloudinary.com")) {
    return url;
  }

  if (url.startsWith("/uploads/")) {
    const filepath = join(process.cwd(), "public", url.replace(/^\/+/, ""));
    const buffer = await readFile(filepath);
    return saveUploadedImage(buffer, {
      folder,
      filenameBase: `${prefix}-${Date.now()}`,
      extension: getImageExtension(url),
    });
  }

  if (/^https?:\/\//i.test(url)) {
    const [mirrored] = await mirrorRemoteImageUrls([url], folder, prefix);
    return mirrored;
  }

  return url;
}

async function main() {
  if (!isCloudStorageEnabled()) {
    throw new Error("Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET first.");
  }

  const dryRun = readFlag("--dry-run");
  let updated = 0;

  const roomImages = await prisma.image.findMany({
    select: { id: true, url: true, listingId: true },
  });

  for (const image of roomImages) {
    if (image.url.includes("res.cloudinary.com")) continue;
    const nextUrl = await mirrorUrl(image.url, "rooms", `room-${image.listingId}`);
    if (nextUrl === image.url) continue;
    if (!dryRun) {
      await prisma.image.update({ where: { id: image.id }, data: { url: nextUrl } });
    }
    updated += 1;
    console.log(`room image ${image.id}`);
  }

  const hotelImages = await prisma.hotelImage.findMany({
    select: { id: true, url: true, hotelId: true },
  });

  for (const image of hotelImages) {
    if (image.url.includes("res.cloudinary.com")) continue;
    const nextUrl = await mirrorUrl(image.url, "hotels", `hotel-${image.hotelId}`);
    if (nextUrl === image.url) continue;
    if (!dryRun) {
      await prisma.hotelImage.update({ where: { id: image.id }, data: { url: nextUrl } });
    }
    updated += 1;
    console.log(`hotel image ${image.id}`);
  }

  const hotels = await prisma.hotel.findMany({
    select: { id: true, logoImageUrl: true, coverImageUrl: true },
  });

  for (const hotel of hotels) {
    for (const field of ["logoImageUrl", "coverImageUrl"] as const) {
      const current = hotel[field];
      if (!current || current.includes("res.cloudinary.com")) continue;
      const nextUrl = await mirrorUrl(current, "hotels", `hotel-${hotel.id}-${field}`);
      if (nextUrl === current) continue;
      if (!dryRun) {
        await prisma.hotel.update({ where: { id: hotel.id }, data: { [field]: nextUrl } });
      }
      updated += 1;
      console.log(`${field} for hotel ${hotel.id}`);
    }
  }

  console.log(`${dryRun ? "Would update" : "Updated"} ${updated} image URL(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
