// Re-translate all hotel and room descriptions from their primary description field.
// Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/resync-description-translations.ts

import { PrismaClient } from "@prisma/client";
import { syncBilingualDescription } from "../lib/sync-bilingual-description";

const prisma = new PrismaClient();

async function main() {
  const hotels = await prisma.hotel.findMany({
    select: { id: true, name: true, description: true },
  });

  for (const hotel of hotels) {
    if (!hotel.description?.trim()) continue;
    const bilingual = await syncBilingualDescription(hotel.description);
    await prisma.hotel.update({
      where: { id: hotel.id },
      data: bilingual,
    });
    console.log(`✓ Hotel: ${hotel.name}`);
  }

  const listings = await prisma.listing.findMany({
    select: { id: true, title: true, description: true },
  });

  for (const listing of listings) {
    if (!listing.description?.trim()) continue;
    const bilingual = await syncBilingualDescription(listing.description);
    await prisma.listing.update({
      where: { id: listing.id },
      data: bilingual,
    });
    console.log(`✓ Room: ${listing.title}`);
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
