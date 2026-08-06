// Script to fix room names for La Arbolita
// Usage: npx tsx scripts/fix-room-names.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hotel = await prisma.hotel.findFirst({ where: { name: "La Arbolita" } });
  
  if (!hotel) {
    console.error("Hotel 'La Arbolita' not found");
    return;
  }

  const roomMappings = [
    { from: "Room 1", to: "Forest Studio 1" },
    { from: "Room 2", to: "Forest Studio 2" },
    { from: "Room 3", to: "Forest Studio 3" },
    { from: "Room 4", to: "Forest Studio 4" },
    { from: "Room 5", to: "Treehouse 1" },
    { from: "Room 6", to: "Treehouse 2" },
    { from: "Room 7", to: "Treehouse 3" },
  ];

  console.log(`Fixing room names for ${hotel.name}...\n`);

  // First, list all current rooms
  const allRooms = await prisma.listing.findMany({
    where: { hotelId: hotel.id },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Current rooms (${allRooms.length} total):`);
  allRooms.forEach((room, idx) => {
    console.log(`  ${idx + 1}. ${room.title} (ID: ${room.id})`);
  });
  console.log("");

  for (const mapping of roomMappings) {
    // Check if target name already exists
    const existingTarget = await prisma.listing.findFirst({
      where: { hotelId: hotel.id, title: mapping.to },
    });

    if (existingTarget) {
      console.log(`Room "${mapping.to}" already exists (ID: ${existingTarget.id}), skipping`);
      // If the target exists, we might want to check if there's also a generic room to handle
      const genericRoom = await prisma.listing.findFirst({
        where: { hotelId: hotel.id, title: mapping.from },
      });
      if (genericRoom) {
        console.log(`  ⚠ Note: Generic "${mapping.from}" also exists (ID: ${genericRoom.id}) - consider manual cleanup`);
      }
      continue;
    }

    // Find room with old name
    const oldRoom = await prisma.listing.findFirst({
      where: { hotelId: hotel.id, title: mapping.from },
    });

    if (oldRoom) {
      try {
        await prisma.listing.update({
          where: { id: oldRoom.id },
          data: {
            title: mapping.to,
            airbnbId: `la-arbolita-${mapping.to.replace(/\s+/g, "-").toLowerCase()}`,
          },
        });
        console.log(`✓ Updated "${mapping.from}" → "${mapping.to}"`);
      } catch (error: any) {
        console.error(`✗ Error updating "${mapping.from}":`, error.message);
      }
    } else {
      console.log(`Room "${mapping.from}" not found, skipping`);
    }
  }

  // List all rooms after update
  const finalRooms = await prisma.listing.findMany({
    where: { hotelId: hotel.id },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nFinal rooms for ${hotel.name} (${finalRooms.length} total):`);
  finalRooms.forEach((room, idx) => {
    const isGeneric = /^Room \d+$/.test(room.title);
    const marker = isGeneric ? " ⚠ (generic - should be renamed)" : "";
    console.log(`  ${idx + 1}. ${room.title}${marker}`);
  });
  
  const remainingGeneric = finalRooms.filter(r => /^Room \d+$/.test(r.title));
  if (remainingGeneric.length > 0) {
    console.log(`\n⚠ Found ${remainingGeneric.length} generic room(s) that need to be removed:`);
    for (const room of remainingGeneric) {
      console.log(`  - ${room.title} (ID: ${room.id})`);
    }
    
    console.log(`\nRemoving generic rooms...`);
    for (const room of remainingGeneric) {
      try {
        // First, delete related calendar sources
        await prisma.calendarSource.deleteMany({
          where: { listingId: room.id },
        });
        
        // Delete related images
        await prisma.image.deleteMany({
          where: { listingId: room.id },
        });
        
        // Delete related bookings (if any)
        await prisma.booking.deleteMany({
          where: { listingId: room.id },
        });
        
        // Now delete the listing
        await prisma.listing.delete({
          where: { id: room.id },
        });
        
        console.log(`✓ Deleted "${room.title}" (ID: ${room.id})`);
      } catch (error: any) {
        console.error(`✗ Error deleting "${room.title}":`, error.message);
      }
    }
  } else {
    console.log(`\n✓ All rooms have been updated to custom names!`);
  }
  
  // Final check
  const finalCheck = await prisma.listing.findMany({
    where: { hotelId: hotel.id },
    orderBy: { title: "asc" },
  });
  
  console.log(`\nFinal rooms for ${hotel.name} (${finalCheck.length} total):`);
  finalCheck.forEach((room, idx) => {
    console.log(`  ${idx + 1}. ${room.title}`);
  });
  
  const stillGeneric = finalCheck.filter(r => /^Room \d+$/.test(r.title));
  if (stillGeneric.length === 0) {
    console.log(`\n✅ Success! All generic rooms have been removed.`);
  } else {
    console.log(`\n⚠ ${stillGeneric.length} generic room(s) could not be removed (may have active bookings).`);
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

