/**
 * Copy /uploads/hotels/* files into public/images/hotels/{slug}/gallery/
 * and rewrite HotelImage + logoImageUrl in the database.
 *
 * Usage:
 *   npx tsx scripts/migrate-hotel-uploads-to-static.ts --hotel "La Arbolita"
 *   npx tsx scripts/migrate-hotel-uploads-to-static.ts --hotel "La Arbolita" --dry-run
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { slugifyHotelName } from "../lib/hotel-cover";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const hotelFlag = process.argv.indexOf("--hotel");
const hotelName =
  hotelFlag !== -1 ? process.argv[hotelFlag + 1] : "La Arbolita";

function uploadsPath(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  return join(process.cwd(), "public", url.replace(/^\//, ""));
}

function staticGalleryUrl(slug: string, filename: string): string {
  return `/images/hotels/${slug}/gallery/${filename}`;
}

async function main() {
  const hotel = await prisma.hotel.findFirst({
    where: { name: hotelName },
    include: { images: { orderBy: { position: "asc" } } },
  });

  if (!hotel) {
    throw new Error(`Hotel "${hotelName}" not found`);
  }

  const slug = slugifyHotelName(hotel.name);
  const galleryDir = join(process.cwd(), "public", "images", "hotels", slug, "gallery");
  if (!dryRun) {
    mkdirSync(galleryDir, { recursive: true });
  }

  let updated = 0;

  async function migrateUrl(url: string | null): Promise<string | null> {
    if (!url || !url.startsWith("/uploads/hotels/")) return url;
    const filename = url.split("/").pop();
    if (!filename) return url;

    const src = uploadsPath(url);
    if (!src || !existsSync(src)) {
      console.warn(`  ! missing file: ${url}`);
      return url;
    }

    const dest = join(galleryDir, filename);
    const nextUrl = staticGalleryUrl(slug, filename);

    if (!dryRun) {
      copyFileSync(src, dest);
    }
    console.log(`${dryRun ? "[dry-run] " : ""}${url} → ${nextUrl}`);
    updated += 1;
    return nextUrl;
  }

  for (const image of hotel.images) {
    const nextUrl = await migrateUrl(image.url);
    if (nextUrl && nextUrl !== image.url && !dryRun) {
      await prisma.hotelImage.update({
        where: { id: image.id },
        data: { url: nextUrl },
      });
    }
  }

  const nextLogo = await migrateUrl(hotel.logoImageUrl);
  if (nextLogo && nextLogo !== hotel.logoImageUrl && !dryRun) {
    await prisma.hotel.update({
      where: { id: hotel.id },
      data: { logoImageUrl: nextLogo },
    });
  }

  console.log(
    `${dryRun ? "Would migrate" : "Migrated"} ${updated} file(s) for ${hotel.name}.`
  );
  console.log(`Gallery dir: public/images/hotels/${slug}/gallery/`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
