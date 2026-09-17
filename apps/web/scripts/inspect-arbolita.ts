import { PrismaClient } from "@prisma/client";

const HOTEL_NAME = "La Arbolita";

async function inspect(label: string, databaseUrl: string) {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const hotel = await prisma.hotel.findFirst({
      where: { name: HOTEL_NAME },
      include: {
        contacts: true,
        images: { orderBy: { position: "asc" } },
        listings: {
          orderBy: { title: "asc" },
          include: {
            images: { orderBy: { position: "asc" } },
            calendarSources: true,
          },
        },
      },
    });

    if (!hotel) {
      console.log(`${label}: hotel not found`);
      return null;
    }

    const summary = {
      id: hotel.id,
      descriptionLen: hotel.description.length,
      descriptionEnLen: hotel.descriptionEn?.length ?? 0,
      descriptionEsLen: hotel.descriptionEs?.length ?? 0,
      coverImageUrl: hotel.coverImageUrl,
      logoImageUrl: hotel.logoImageUrl,
      mainContactNumber: hotel.mainContactNumber,
      contacts: hotel.contacts.length,
      hotelImages: hotel.images.length,
      listings: hotel.listings.map((l) => ({
        title: l.title,
        images: l.images.length,
        descriptionLen: l.description?.length ?? 0,
        nightlyBasePrice: l.nightlyBasePrice,
        airbnbUrl: l.airbnbUrl,
        calendars: l.calendarSources.length,
      })),
    };

    console.log(`${label}:`);
    console.log(JSON.stringify(summary, null, 2));
    return hotel;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const localUrl =
    process.env.LOCAL_DATABASE_URL ||
    "postgresql://casayahua:casayahua@localhost:5432/casayahua";
  const prodUrl =
    process.env.PROD_DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL;

  try {
    await inspect("LOCAL", localUrl);
  } catch (error) {
    console.log(
      "LOCAL: unavailable —",
      error instanceof Error ? error.message : error
    );
  }

  if (!prodUrl) {
    console.log("PRODUCTION: set PROD_DATABASE_URL, DIRECT_URL, or DATABASE_URL");
    return;
  }

  await inspect("PRODUCTION", prodUrl);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
