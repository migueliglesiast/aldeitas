import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hotel = await prisma.hotel.create({
    data: {
      name: "Casa Yahua",
      description: "Boutique stays managed centrally. Multiple listings per hotel.",
      location: "Mexico City, MX",
      listings: {
        create: [
          {
            airbnbId: "46495863",
            airbnbUrl: "https://www.airbnb.com/rooms/46495863",
            icalUrl:
              "https://www.airbnb.com/calendar/ical/46495863.ics?s=02b8b1c66d4cc69dac28803acff4efda",
            title: "Casa Yahua Listing A",
            nightlyBasePrice: 10000,
          },
        ],
      },
    }
  });

  const listing = await prisma.listing.findFirst({
    where: { hotelId: hotel.id },
  });

  if (listing?.icalUrl) {
    await prisma.calendarSource.upsert({
      where: { icalUrl: listing.icalUrl },
      update: {
        listingId: listing.id,
      },
      create: {
        name: `Airbnb iCal for ${listing.title}`,
        icalUrl: listing.icalUrl,
        listingId: listing.id,
      },
    });
  }

  // Ensure a Demo Hotel exists, then populate it with multiple randomized listings
  const demoHotel =
    (await prisma.hotel.findFirst({ where: { name: "Demo Hotel" } })) ||
    (await prisma.hotel.create({
      data: {
        name: "Demo Hotel",
        description: "A demo property with multiple sample listings.",
        location: "Anywhere, Earth",
      },
    }));

  const titles = [
    "Ocean View Suite",
    "Garden Studio",
    "City Loft",
    "Mountain Retreat",
    "Cozy Bungalow",
    "Sunset Apartment",
  ];

  // Create 12 listings if they don't already exist (idempotent by airbnbId + hotel)
  for (let i = 1; i <= 12; i++) {
    const airbnbId = `demo-auto-${i}`;
    const existing = await prisma.listing.findFirst({
      where: { hotelId: demoHotel.id, airbnbId },
      select: { id: true },
    });
    if (existing) continue;

    const title = `${titles[i % titles.length]} #${i}`;
    const nightlyBasePrice = 8000 + Math.floor(Math.random() * 15000); // $80 - $230

    // Use Picsum photos to avoid 404s and vary images
    const imgBaseId = 100 + i * 7;
    await prisma.listing.create({
      data: {
        hotelId: demoHotel.id,
        airbnbId,
        airbnbUrl: "",
        title,
        nightlyBasePrice,
        baseCurrency: "USD",
        images: {
          create: [
            { url: `https://picsum.photos/id/${imgBaseId}/1600/900`, position: 0 },
            { url: `https://picsum.photos/id/${imgBaseId + 1}/1600/900`, position: 1 },
            { url: `https://picsum.photos/id/${imgBaseId + 2}/1600/900`, position: 2 },
          ],
        },
      },
    });
  }

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


