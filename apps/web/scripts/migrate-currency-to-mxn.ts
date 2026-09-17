/**
 * One-time migration: convert USD listing/booking amounts to MXN.
 * Usage: npm run migrate-currency-to-mxn
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const USD_TO_MXN = Number(process.env.MIGRATE_USD_TO_MXN_RATE || "17.5");

async function main() {
  const listings = await prisma.listing.findMany({
    where: { baseCurrency: "USD" },
    select: { id: true, nightlyBasePrice: true },
  });

  for (const listing of listings) {
    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        baseCurrency: "MXN",
        nightlyBasePrice: Math.round(listing.nightlyBasePrice * USD_TO_MXN),
      },
    });
  }

  const bookings = await prisma.booking.findMany({
    where: { currency: "USD" },
    select: { id: true, totalPriceCents: true },
  });

  for (const booking of bookings) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        currency: "MXN",
        totalPriceCents: Math.round(booking.totalPriceCents * USD_TO_MXN),
      },
    });
  }

  console.log(
    `Migrated ${listings.length} listing(s) and ${bookings.length} booking(s) to MXN (rate ${USD_TO_MXN}).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
