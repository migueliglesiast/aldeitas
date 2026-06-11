// Copy room details (and optionally images) between La Arbolita listings.
// Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/copy-arbolita-room-data.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INFO_FIELDS = [
  "description",
  "guestsInBeds",
  "guestsInBedsAndSofas",
  "numberOfBeds",
  "numberOfBathrooms",
  "bedType",
] as const;

type CopyTask = {
  sourceTitle: string;
  targetTitles: string[];
  copyImages: boolean;
};

const COPY_TASKS: CopyTask[] = [
  {
    sourceTitle: "Forest Studio 1",
    targetTitles: ["Forest Studio 2", "Forest Studio 3", "Forest Studio 4"],
    copyImages: true,
  },
  {
    sourceTitle: "Treehouse 1",
    targetTitles: ["Treehouse 2"],
    copyImages: true,
  },
  {
    sourceTitle: "Treehouse 1",
    targetTitles: ["Treehouse 3"],
    copyImages: false,
  },
];

async function findListing(hotelId: string, title: string) {
  const listing = await prisma.listing.findFirst({
    where: { hotelId, title },
    include: { images: { orderBy: { position: "asc" } } },
  });
  if (!listing) {
    throw new Error(`Listing "${title}" not found`);
  }
  return listing;
}

async function copyListingInfo(
  sourceId: string,
  targetId: string,
  copyImages: boolean
) {
  const source = await prisma.listing.findUnique({
    where: { id: sourceId },
    include: { images: { orderBy: { position: "asc" } } },
  });
  if (!source) throw new Error(`Source listing ${sourceId} not found`);

  const data = Object.fromEntries(
    INFO_FIELDS.map((field) => [field, source[field]])
  );

  await prisma.listing.update({
    where: { id: targetId },
    data,
  });

  if (!copyImages) return;

  await prisma.image.deleteMany({ where: { listingId: targetId } });
  if (source.images.length > 0) {
    await prisma.$transaction(
      source.images.map((image, position) =>
        prisma.image.create({
          data: {
            listingId: targetId,
            url: image.url,
            position,
          },
        })
      )
    );
  }
}

async function main() {
  const hotel = await prisma.hotel.findFirst({ where: { name: "La Arbolita" } });
  if (!hotel) {
    throw new Error("Hotel 'La Arbolita' not found");
  }

  for (const task of COPY_TASKS) {
    const source = await findListing(hotel.id, task.sourceTitle);

    for (const targetTitle of task.targetTitles) {
      const target = await findListing(hotel.id, targetTitle);
      await copyListingInfo(source.id, target.id, task.copyImages);

      const mode = task.copyImages ? "info + images" : "info only";
      console.log(`✓ ${task.sourceTitle} → ${targetTitle} (${mode})`);
    }
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
