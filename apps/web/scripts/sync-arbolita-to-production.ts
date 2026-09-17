/**
 * Copy La Arbolita hotel data from local SQLite (prisma/dev.db) to production Postgres (Neon).
 *
 * Usage:
 *   npx tsx scripts/sync-arbolita-to-production.ts
 *   npx tsx scripts/sync-arbolita-to-production.ts --dry-run
 *
 * Env:
 *   PROD_DATABASE_URL or DIRECT_URL — production Postgres (defaults to .env)
 *   LOCAL_SQLITE_PATH — defaults to prisma/dev.db
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  getImageExtension,
  isCloudStorageEnabled,
  saveUploadedImage,
} from "../lib/image-storage";

const HOTEL_NAME = "La Arbolita";
const SQLITE_PATH =
  process.env.LOCAL_SQLITE_PATH ||
  join(process.cwd(), "prisma", "dev.db");
const dryRun = process.argv.includes("--dry-run");

type SqlRow = Record<string, unknown>;

function querySqlite<T extends SqlRow>(sql: string): T[] {
  if (!existsSync(SQLITE_PATH)) {
    throw new Error(`Local SQLite database not found: ${SQLITE_PATH}`);
  }
  const output = execFileSync("sqlite3", ["-json", SQLITE_PATH, sql], {
    encoding: "utf8",
  }).trim();
  if (!output) return [];
  return JSON.parse(output) as T[];
}

async function resolveImageUrl(
  url: string | null | undefined,
  prefix: "hotel" | "room",
  targetId: string
): Promise<string | null> {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (dryRun) return url;

  const localPath = join(process.cwd(), "public", url.replace(/^\//, ""));
  if (!existsSync(localPath)) {
    console.warn(`  ! Missing local file for ${url}`);
    return url;
  }

  if (!isCloudStorageEnabled()) {
    console.warn(
      `  ! Keeping ${url} (set CLOUDINARY_* env to upload hotel gallery to production CDN)`
    );
    return url;
  }

  const buffer = readFileSync(localPath);
  return saveUploadedImage(buffer, {
    folder: prefix === "hotel" ? "hotels" : "rooms",
    filenameBase: `${prefix}-${targetId}-${Date.now()}`,
    extension: getImageExtension(url),
  });
}

async function main() {
  const prodUrl =
    process.env.PROD_DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL;

  if (!prodUrl) {
    throw new Error("Set PROD_DATABASE_URL, DIRECT_URL, or DATABASE_URL");
  }

  const [localHotel] = querySqlite<SqlRow>(
    `SELECT * FROM Hotel WHERE name = '${HOTEL_NAME}' LIMIT 1`
  );
  if (!localHotel) {
    throw new Error(`"${HOTEL_NAME}" not found in ${SQLITE_PATH}`);
  }

  const localHotelId = String(localHotel.id);
  const localContacts = querySqlite<SqlRow>(
    `SELECT type, name, phone FROM HotelContact WHERE hotelId = '${localHotelId}' ORDER BY type, name`
  );
  const localHotelImages = querySqlite<{ url: string; position: number }>(
    `SELECT url, position FROM HotelImage WHERE hotelId = '${localHotelId}' ORDER BY position ASC`
  );
  const localListings = querySqlite<SqlRow>(
    `SELECT * FROM Listing WHERE hotelId = '${localHotelId}' ORDER BY title ASC`
  );

  const prisma = new PrismaClient({
    datasources: { db: { url: prodUrl } },
  });

  try {
    const prodHotel = await prisma.hotel.findFirst({
      where: { name: HOTEL_NAME },
      include: {
        listings: { orderBy: { title: "asc" } },
      },
    });

    if (!prodHotel) {
      throw new Error(`"${HOTEL_NAME}" not found in production database`);
    }

    console.log(
      `${dryRun ? "[dry-run] " : ""}Syncing ${HOTEL_NAME}: ${SQLITE_PATH} → production`
    );
    console.log(`  Production hotel id: ${prodHotel.id}`);
    console.log(
      `  Local: ${localListings.length} listings, ${localContacts.length} contacts, ${localHotelImages.length} hotel images`
    );

    const logoImageUrl = await resolveImageUrl(
      localHotel.logoImageUrl as string | null,
      "hotel",
      prodHotel.id
    );
    const coverImageUrl = await resolveImageUrl(
      localHotel.coverImageUrl as string | null,
      "hotel",
      prodHotel.id
    );

    const hotelData = {
      description: String(localHotel.description),
      descriptionEn: (localHotel.descriptionEn as string | null) ?? null,
      descriptionEs: (localHotel.descriptionEs as string | null) ?? null,
      location: String(localHotel.location),
      googleMapsUrl: (localHotel.googleMapsUrl as string | null) ?? null,
      latitude: (localHotel.latitude as number | null) ?? null,
      longitude: (localHotel.longitude as number | null) ?? null,
      googleDriveFolderId:
        (localHotel.googleDriveFolderId as string | null) ?? null,
      coverImageUrl,
      logoImageUrl,
      mainContactNumber:
        (localHotel.mainContactNumber as string | null) ?? null,
    };

    if (dryRun) {
      console.log("  Would update hotel:", hotelData);
    } else {
      await prisma.hotel.update({
        where: { id: prodHotel.id },
        data: hotelData,
      });
      console.log("✓ Hotel fields updated");
    }

    if (dryRun) {
      console.log(`  Would replace ${localContacts.length} contacts`);
    } else {
      await prisma.hotelContact.deleteMany({ where: { hotelId: prodHotel.id } });
      if (localContacts.length > 0) {
        await prisma.hotelContact.createMany({
          data: localContacts.map((contact) => ({
            hotelId: prodHotel.id,
            type: String(contact.type),
            name: String(contact.name),
            phone: String(contact.phone),
          })),
        });
      }
      console.log(`✓ ${localContacts.length} contacts synced`);
    }

    if (dryRun) {
      console.log(`  Would replace ${localHotelImages.length} hotel images`);
    } else {
      await prisma.hotelImage.deleteMany({ where: { hotelId: prodHotel.id } });
      for (const image of localHotelImages) {
        const url = await resolveImageUrl(image.url, "hotel", prodHotel.id);
        if (!url) continue;
        await prisma.hotelImage.create({
          data: {
            hotelId: prodHotel.id,
            url,
            position: image.position,
          },
        });
      }
      console.log(`✓ ${localHotelImages.length} hotel images synced`);
    }

    for (const localListing of localListings) {
      const title = String(localListing.title);
      const prodListing = prodHotel.listings.find((l) => l.title === title);
      if (!prodListing) {
        console.warn(`  ! Production listing not found: ${title}`);
        continue;
      }

      const localListingId = String(localListing.id);
      const localImages = querySqlite<{ url: string; position: number }>(
        `SELECT url, position FROM Image WHERE listingId = '${localListingId}' ORDER BY position ASC`
      );
      const localCalendars = querySqlite<{ name: string; icalUrl: string }>(
        `SELECT name, icalUrl FROM CalendarSource WHERE listingId = '${localListingId}'`
      );

      const listingData = {
        airbnbId: String(localListing.airbnbId),
        airbnbUrl: String(localListing.airbnbUrl || ""),
        icalUrl: (localListing.icalUrl as string | null) ?? null,
        description: (localListing.description as string | null) ?? null,
        descriptionEn: (localListing.descriptionEn as string | null) ?? null,
        descriptionEs: (localListing.descriptionEs as string | null) ?? null,
        baseCurrency: String(localListing.baseCurrency || "MXN"),
        nightlyBasePrice: Number(localListing.nightlyBasePrice || 0),
        guestsInBeds: (localListing.guestsInBeds as number | null) ?? null,
        guestsInBedsAndSofas:
          (localListing.guestsInBedsAndSofas as number | null) ?? null,
        numberOfBeds: (localListing.numberOfBeds as number | null) ?? null,
        numberOfBathrooms:
          (localListing.numberOfBathrooms as number | null) ?? null,
        bedType: (localListing.bedType as string | null) ?? null,
      };

      if (dryRun) {
        console.log(`  Would update ${title}:`, {
          ...listingData,
          images: localImages.length,
          calendars: localCalendars.length,
        });
        continue;
      }

      await prisma.listing.update({
        where: { id: prodListing.id },
        data: listingData,
      });

      const existingCalendars = await prisma.calendarSource.findMany({
        where: { listingId: prodListing.id },
      });
      for (const calendar of existingCalendars) {
        await prisma.calendarSource.delete({ where: { id: calendar.id } });
      }
      for (const calendar of localCalendars) {
        await prisma.calendarSource.create({
          data: {
            name: calendar.name,
            icalUrl: calendar.icalUrl,
            listingId: prodListing.id,
          },
        });
      }

      await prisma.image.deleteMany({ where: { listingId: prodListing.id } });
      for (const image of localImages) {
        const url = await resolveImageUrl(
          image.url,
          "room",
          prodListing.id
        );
        if (!url) continue;
        await prisma.image.create({
          data: {
            listingId: prodListing.id,
            url,
            position: image.position,
          },
        });
      }

      console.log(
        `✓ ${title} — ${localImages.length} images, ${localCalendars.length} calendars`
      );
    }

    console.log(dryRun ? "Dry run complete." : "La Arbolita sync complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Sync failed:", error);
  process.exit(1);
});
