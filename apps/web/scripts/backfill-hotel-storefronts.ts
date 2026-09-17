/**
 * Backfill hotel.slug for existing rows and set Aldeita Mixteca storefront domain.
 * Run: npx tsx scripts/backfill-hotel-storefronts.ts
 */
import { PrismaClient } from "@prisma/client";
import { slugifyHotelName } from "../lib/hotel-cover";

const prisma = new PrismaClient();

async function main() {
  const hotels = await prisma.hotel.findMany({ orderBy: { createdAt: "asc" } });
  const usedSlugs = new Set<string>();

  for (const hotel of hotels) {
    let slug = hotel.slug || slugifyHotelName(hotel.name);
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${hotel.id.slice(-6)}`;
    }
    usedSlugs.add(slug);

    const customDomain =
      hotel.name === "Aldeita Mixteca"
        ? "aldeitamixteca.com"
        : hotel.customDomain;

    await prisma.hotel.update({
      where: { id: hotel.id },
      data: { slug, customDomain },
    });

    console.log(`${hotel.name} -> slug=${slug} domain=${customDomain ?? "(none)"}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
