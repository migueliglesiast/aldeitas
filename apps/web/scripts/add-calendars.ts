// Script to programmatically add iCal URLs (Guesty, Airbnb, etc.) to listings
// Usage: npx tsx scripts/add-calendars.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Define your iCal URLs here
  // Format: { hotelName, roomTitle, icalUrl, calendarName }
  const calendars: Array<{
    hotelName: string;
    roomTitle: string; // e.g., "Room 1", "Room 2", etc.
    icalUrl: string;
    calendarName: string; // e.g., "Guesty - La Arbolita Room 1"
  }> = [
    // Example for La Arbolita
    // {
    //   hotelName: "La Arbolita",
    //   roomTitle: "Room 1",
    //   icalUrl: "https://api.guesty.com/ical/your-guesty-calendar-id",
    //   calendarName: "Guesty - La Arbolita Room 1"
    // },
    // Add more calendars here...
  ];

  for (const cal of calendars) {
    // Find the hotel
    const hotel = await prisma.hotel.findFirst({
      where: { name: cal.hotelName },
    });

    if (!hotel) {
      console.warn(`Hotel "${cal.hotelName}" not found. Skipping calendar "${cal.calendarName}"`);
      continue;
    }

    // Find the listing/room
    const listing = await prisma.listing.findFirst({
      where: {
        hotelId: hotel.id,
        title: cal.roomTitle,
      },
    });

    if (!listing) {
      console.warn(`Listing "${cal.roomTitle}" not found in "${cal.hotelName}". Skipping calendar "${cal.calendarName}"`);
      continue;
    }

    // Add or update the calendar source
    const calendarSource = await prisma.calendarSource.upsert({
      where: { icalUrl: cal.icalUrl },
      update: {
        name: cal.calendarName,
        listingId: listing.id,
      },
      create: {
        name: cal.calendarName,
        icalUrl: cal.icalUrl,
        listingId: listing.id,
      },
    });

    console.log(`✓ Added calendar "${cal.calendarName}" to ${cal.hotelName} - ${cal.roomTitle}`);
  }

  console.log("\n✅ Calendar setup complete!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

