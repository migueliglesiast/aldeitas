// Seeds the dedicated E2E SQLite database with a deterministic dataset.
import { PrismaClient } from "@prisma/client";
import {
  BLOCKED_END,
  BLOCKED_START,
  E2E_BLOCKED_LISTING,
  E2E_HOTEL,
  E2E_LISTING,
} from "./fixtures";

const prisma = new PrismaClient();

async function main() {
  await prisma.booking.deleteMany();
  await prisma.calendarSource.deleteMany();
  await prisma.image.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.user.deleteMany();

  const hotel = await prisma.hotel.create({
    data: {
      name: E2E_HOTEL,
      description: "Seeded hotel used by the Playwright suite",
      location: "Puerto Escondido",
    },
  });

  await prisma.listing.create({
    data: {
      hotelId: hotel.id,
      airbnbId: "e2e-free",
      airbnbUrl: "https://www.airbnb.com/rooms/e2e-free",
      title: E2E_LISTING,
      description: "Bookable suite",
      nightlyBasePrice: 15000,
      baseCurrency: "USD",
    },
  });

  const blocked = await prisma.listing.create({
    data: {
      hotelId: hotel.id,
      airbnbId: "e2e-blocked",
      airbnbUrl: "https://www.airbnb.com/rooms/e2e-blocked",
      title: E2E_BLOCKED_LISTING,
      description: "Suite with an existing confirmed booking",
      nightlyBasePrice: 20000,
      baseCurrency: "USD",
    },
  });

  await prisma.booking.create({
    data: {
      listingId: blocked.id,
      guestEmail: "seed@example.com",
      guestPhone: "5215550000",
      startDate: new Date(`${BLOCKED_START}T00:00:00Z`),
      endDate: new Date(`${BLOCKED_END}T00:00:00Z`),
      totalPriceCents: 100000,
      currency: "USD",
      status: "CONFIRMED",
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
