/**
 * Rename Aldeita Mixteca rooms and set storefront tagline.
 * Run: npx tsx scripts/rename-mixteca-rooms.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROOM_NAMES = [
  "Depa 1",
  "Suite Dalia",
  "Balcón",
  "Depa 2",
  "Palapa",
  "Palmera",
  "Casa Mono",
  "Casa Rana",
  "Casa Loba",
];

const STOREFRONT_TAGLINE =
  "Una aldeita a pasos de la playa en el corazon de Zicatela";

async function main() {
  const hotel = await prisma.hotel.findFirst({
    where: { name: "Aldeita Mixteca" },
    include: {
      listings: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!hotel) {
    throw new Error("Aldeita Mixteca not found");
  }

  await prisma.hotel.update({
    where: { id: hotel.id },
    data: { storefrontTagline: STOREFRONT_TAGLINE },
  });
  console.log(`Tagline set: ${STOREFRONT_TAGLINE}`);

  if (hotel.listings.length !== ROOM_NAMES.length) {
    console.warn(
      `Expected ${ROOM_NAMES.length} rooms, found ${hotel.listings.length}. Renaming in order anyway.`
    );
  }

  for (let i = 0; i < hotel.listings.length && i < ROOM_NAMES.length; i++) {
    const listing = hotel.listings[i];
    const nextTitle = ROOM_NAMES[i];
    await prisma.listing.update({
      where: { id: listing.id },
      data: { title: nextTitle },
    });
    console.log(`  ${listing.title} → ${nextTitle}`);
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
