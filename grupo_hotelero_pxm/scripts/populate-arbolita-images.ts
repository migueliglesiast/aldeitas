// Populate La Arbolita room images from Airbnb listing pages.
// Usage: npx tsx scripts/populate-arbolita-images.ts

import { PrismaClient } from "@prisma/client";
import { scrapeListingImages } from "../lib/airbnb";

const prisma = new PrismaClient();

/** User-specified Airbnb URLs per room group */
const ROOM_IMAGE_SOURCES: Array<{ roomTitle: string; airbnbUrl: string }> = [
  { roomTitle: "Forest Studio 1", airbnbUrl: "https://www.airbnb.com/h/arbolita4" },
  { roomTitle: "Forest Studio 2", airbnbUrl: "https://www.airbnb.com/h/arbolita4" },
  { roomTitle: "Forest Studio 3", airbnbUrl: "https://www.airbnb.com/h/arbolita4" },
  { roomTitle: "Forest Studio 4", airbnbUrl: "https://www.airbnb.com/h/arbolita4" },
  { roomTitle: "Treehouse 1", airbnbUrl: "https://www.airbnb.com/h/arbolita6" },
  { roomTitle: "Treehouse 2", airbnbUrl: "https://www.airbnb.com/h/arbolita6" },
  { roomTitle: "Treehouse 3", airbnbUrl: "https://www.airbnb.com/h/arbolita7" },
];

async function main() {
  const hotel = await prisma.hotel.findFirst({ where: { name: "La Arbolita" } });
  if (!hotel) {
    console.error("Hotel 'La Arbolita' not found");
    return;
  }

  const urlCache = new Map<string, string[]>();

  for (const { roomTitle, airbnbUrl } of ROOM_IMAGE_SOURCES) {
    const listing = await prisma.listing.findFirst({
      where: { hotelId: hotel.id, title: roomTitle },
    });
    if (!listing) {
      console.warn(`Listing "${roomTitle}" not found, skipping`);
      continue;
    }

    let urls = urlCache.get(airbnbUrl);
    if (!urls) {
      console.log(`Scraping ${airbnbUrl} ...`);
      urls = await scrapeListingImages(airbnbUrl);
      urlCache.set(airbnbUrl, urls);
      console.log(`  Found ${urls.length} images`);
    }

    if (urls.length === 0) {
      console.warn(`No images for "${roomTitle}" from ${airbnbUrl}`);
      continue;
    }

    await prisma.image.deleteMany({ where: { listingId: listing.id } });
    await prisma.$transaction(
      urls.map((url, idx) =>
        prisma.image.create({ data: { listingId: listing.id, url, position: idx } })
      )
    );
    await prisma.listing.update({
      where: { id: listing.id },
      data: { airbnbUrl },
    });

    console.log(`✓ ${roomTitle}: ${urls.length} images (${airbnbUrl})`);
  }
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
