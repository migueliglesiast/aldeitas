// @ts-nocheck - Prisma client types are generated correctly, this is an IDE cache issue
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed the nine initial hotels and their room counts in the requested order.
  // 
  // IMPORTANT: Use Google Maps EMBED URLs (not share URLs)
  // To get embed URL:
  //   1. Open Google Maps and find the hotel location
  //   2. Click "Share" → "Embed a map"
  //   3. Copy the iframe src URL (starts with https://www.google.com/maps/embed?...)
  //   4. Paste it in the googleMapsUrl field below
  //
  const initialHotels: {
    name: string;
    location: string;
    rooms: number;
    latitude: number;
    longitude: number;
    googleMapsUrl?: string;
    roomTitles?: string[];
  }[] = [
    { name: "Aldeita Mixteca", location: "Tamarindos", rooms: 9, latitude: 15.842121, longitude: -97.051367, googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3838.275304692342!2d-97.05136672387734!3d15.842121384804926!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85b8f9ea9ababb35%3A0x2dc27d4d89815aac!2sAldeita%20Mixteca!5e0!3m2!1sen!2smx!4v1765134111265!5m2!1sen!2smx"},
    { name: "La Otra Aldeita", location: "Punta Zicatela", rooms: 5, latitude: 15.8392, longitude: -97.0478, googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3838.275304692342!2d-97.05136672387734!3d15.842121384804926!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85b8f9a1e452fcd7%3A0xa6ee699f5f6f4264!2sLa%20Otra%20Aldeita!5e0!3m2!1sen!2smx!4v1765134178380!5m2!1sen!2smx"},
    { 
      name: "La Arbolita", 
      location: "Santa María", 
      rooms: 7,
      latitude: 15.846468,
      longitude: -97.052432,
      googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3838.192660747881!2d-97.052432423726!3d15.846468284801176!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85b8f9ba8b18d711%3A0xa2d375bdc91d5464!2sLa%20Arbolita!5e0!3m2!1sen!2smx!4v1765134212453!5m2!1sen!2smx",
      roomTitles: ["Forest Studio 1", "Forest Studio 2", "Forest Studio 3", "Forest Studio 4", "Treehouse 1", "Treehouse 2", "Treehouse 3"]
    },
    { name: "Nido Escondido", location: "Tamarindos", rooms: 7, latitude: 15.8458, longitude: -97.0519, googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3838.192660747881!2d-97.052432423726!3d15.846468284801176!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85b8f9cbcefdbc8f%3A0xded70dbab6709cfe!2sNido%20Escondido!5e0!3m2!1sen!2smx!4v1765134499157!5m2!1sen!2smx"},
    { name: "Casa Yahua", location: "Tamarindos", rooms: 8, latitude: 15.842778, longitude: -97.048708, googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3838.2628227266855!2d-97.04870772357482!3d15.842777984804467!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85b8f900465b9627%3A0x7a7a7a854fb822d1!2sHotel%20Boutique%20Casa%20Yahual!5e0!3m2!1sen!2smx!4v1765134542210!5m2!1sen!2smx"},
    { name: "Casa Guadalupe", location: "Punta Zicatela", rooms: 2, latitude: 15.841474, longitude: -97.048905, googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3838.2876131733597!2d-97.0489054238774!3d15.841473884805495!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85b8f90023abb9dd%3A0xaf2b817c8fc6cc1!2sCasa%20Guadalupe!5e0!3m2!1sen!2smx!4v1765134665925!5m2!1sen!2smx" },
    { name: "Casa Oaxira", location: "Tamarindos", rooms: 2, latitude: 15.843057, longitude: -97.048809, googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3838.257518784235!2d-97.0488088238774!3d15.84305698480412!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85b8f92a11662a85%3A0x288675294967ceb6!2sOaxira!5e0!3m2!1sen!2smx!4v1765134736922!5m2!1sen!2smx"},
    { name: "Coco By-The-Beach", location: "Punta Zicatela", rooms: 1, latitude: 15.838504, longitude: -97.046378, googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d554.7807715785118!2d-97.04637841799085!3d15.838503854166042!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2smx!4v1765134837690!5m2!1sen!2smx" },
    { name: "Ranchito Zicatela", location: "Punta Zicatela", rooms: 1, latitude: 15.8379, longitude: -97.0459, googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d554.7807715785118!2d-97.04637841799085!3d15.838503854166042!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2smx!4v1765134837690!5m2!1sen!2smx" },
    { name: "Espacio Malinxhe", location: "Punta Zicatela", rooms: 10, latitude: 15.836421, longitude: -97.043732, googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3840.489980945963!2d-97.04373195916031!3d15.836420561464225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMTXCsDUwJzA0LjEiTiA5N8KwMDInMjUuNCJX!5e0!3m2!1sen!2smx!4v1765132465505!5m2!1sen!2smx"},
  ];
  
  for (let hIndex = 0; hIndex < initialHotels.length; hIndex++) {
    const spec = initialHotels[hIndex];

    // Find or create hotel by name (idempotent without unique constraint)
    let hotel = await prisma.hotel.findFirst({ where: { name: spec.name } });
    if (!hotel) {
      hotel = await prisma.hotel.create({
        data: {
          name: spec.name,
          description: `${spec.name} in ${spec.location}`,
          location: spec.location,
          latitude: spec.latitude,
          longitude: spec.longitude,
          googleMapsUrl: spec.googleMapsUrl || null,
        },
      });
    } else {
      await prisma.hotel.update({
        where: { id: hotel.id },
        data: { 
          location: spec.location,
          latitude: spec.latitude,
          longitude: spec.longitude,
          googleMapsUrl: spec.googleMapsUrl || null,
        },
      });
    }

    // Handle room creation/updates
    if (spec.roomTitles && spec.roomTitles.length > 0) {
      // If custom room titles are provided, update existing generic rooms or create new ones
      // First, get all existing rooms for this hotel, ordered by creation
      const existingRooms = await prisma.listing.findMany({
        where: { hotelId: hotel.id },
        orderBy: { createdAt: "asc" },
      });
      
      // Separate generic rooms from custom-named rooms
      const genericRooms = existingRooms.filter(r => /^Room \d+$/.test(r.title));
      const customRooms = existingRooms.filter(r => !/^Room \d+$/.test(r.title));
      
      console.log(`[${spec.name}] Found ${genericRooms.length} generic room(s) and ${customRooms.length} custom room(s)`);
      
      // Update generic rooms to use custom titles (up to the number we need)
      for (let i = 0; i < spec.roomTitles.length; i++) {
        const roomTitle = spec.roomTitles[i];
        const nightlyBasePrice = 150000 + Math.floor(Math.random() * 200000); // $1,500 - $3,500 MXN
        const imgBaseId = 200 + (hIndex * 20) + i + 1;
        
        // Check if a room with this exact title already exists
        let existingRoom = await prisma.listing.findFirst({
          where: { hotelId: hotel.id, title: roomTitle },
        });
        
        if (existingRoom) {
          console.log(`[${spec.name}] Room "${roomTitle}" already exists, skipping`);
          continue;
        }
        
        // Try to update a generic room if available
        if (i < genericRooms.length) {
          const genericRoom = genericRooms[i];
          try {
            existingRoom = await prisma.listing.update({
              where: { id: genericRoom.id },
              data: {
                title: roomTitle,
                airbnbId: `${spec.name.replace(/\s+/g, "-").toLowerCase()}-${roomTitle.replace(/\s+/g, "-").toLowerCase()}`,
              },
            });
            console.log(`✓ Updated "${genericRoom.title}" to "${roomTitle}" for ${spec.name}`);
          } catch (error) {
            console.error(`Error updating room ${genericRoom.id}:`, error);
          }
        } else {
          // Create a new room if no generic room available
          try {
            existingRoom = await prisma.listing.create({
              data: {
                hotelId: hotel.id,
                airbnbId: `${spec.name.replace(/\s+/g, "-").toLowerCase()}-${roomTitle.replace(/\s+/g, "-").toLowerCase()}`,
                airbnbUrl: "",
                title: roomTitle,
                nightlyBasePrice,
                baseCurrency: "MXN",
                images: {
                  create: [
                    { url: `https://picsum.photos/id/${imgBaseId}/1600/900`, position: 0 },
                    { url: `https://picsum.photos/id/${imgBaseId + 1}/1600/900`, position: 1 },
                    { url: `https://picsum.photos/id/${imgBaseId + 2}/1600/900`, position: 2 },
                  ],
                },
              },
            });
            console.log(`✓ Created room "${roomTitle}" for ${spec.name}`);
          } catch (error) {
            console.error(`Error creating room "${roomTitle}":`, error);
          }
        }
      }
      
      // Delete remaining generic rooms that weren't updated (to prevent duplicates)
      const remainingGeneric = genericRooms.slice(spec.roomTitles.length);
      if (remainingGeneric.length > 0) {
        console.log(`[${spec.name}] Removing ${remainingGeneric.length} unused generic room(s)...`);
        for (const genericRoom of remainingGeneric) {
          try {
            // Delete related data first to avoid foreign key constraints
            await prisma.calendarSource.deleteMany({ where: { listingId: genericRoom.id } });
            await prisma.image.deleteMany({ where: { listingId: genericRoom.id } });
            await prisma.booking.deleteMany({ where: { listingId: genericRoom.id } });
            
            // Now delete the listing
            await prisma.listing.delete({ where: { id: genericRoom.id } });
            console.log(`  ✓ Deleted unused "${genericRoom.title}" from ${spec.name}`);
          } catch (error: any) {
            console.error(`  ✗ Could not delete "${genericRoom.title}":`, error.message);
          }
        }
      }
    } else {
      // Default behavior: create rooms with "Room 1", "Room 2", etc.
      const existingCount = await prisma.listing.count({ where: { hotelId: hotel.id } });
      const toCreate = Math.max(0, spec.rooms - existingCount);

      for (let i = 1; i <= toCreate; i++) {
        const nightlyBasePrice = 150000 + Math.floor(Math.random() * 200000); // $1,500 - $3,500 MXN
        const imgBaseId = 200 + (hIndex * 20) + i;
        const roomTitle = `Room ${existingCount + i}`;
        
        await prisma.listing.create({
          data: {
            hotelId: hotel.id,
            airbnbId: `${spec.name.replace(/\s+/g, "-").toLowerCase()}-room-${existingCount + i}`,
            airbnbUrl: "",
            title: roomTitle,
            nightlyBasePrice,
            baseCurrency: "MXN",
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
    }
  }

  // Add iCal calendars programmatically
  // Format: { hotelName, roomTitle, icalUrl, calendarName }
  // Uncomment and fill in your Guesty iCal URLs below
  const calendars: Array<{
    hotelName: string;
    roomTitle: string;
    icalUrl: string;
    calendarName: string;
  }> = [
    {
      hotelName: "La Arbolita",
      roomTitle: "Forest Studio 1",
      icalUrl: "https://www.airbnb.com/calendar/ical/1041526793864468718.ics?s=01c899d4528642080f8d1930518f0458",
      calendarName: "La Arbolita Room 1"
    },
    {
      hotelName: "La Arbolita",
      roomTitle: "Forest Studio 2",
      icalUrl: "https://www.airbnb.com/calendar/ical/1042170388489793535.ics?s=7f464d039e44c779cf67532818fa2883",
      calendarName: "La Arbolita Room 2"
    },
    {
      hotelName: "La Arbolita",
      roomTitle: "Forest Studio 3",
      icalUrl: "https://www.airbnb.com/calendar/ical/1027012314067989234.ics?s=244b571e91a6689ad260c457c2aa7a1c",
      calendarName: "La Arbolita Room 3"
    },
    {
      hotelName: "La Arbolita",
      roomTitle: "Forest Studio 4",
      icalUrl: "https://www.airbnb.com/calendar/ical/1080458876652816533.ics?s=deb4a269511e4a37b20ed19ed1fbe560",
      calendarName: "La Arbolita Room 4"
    },
    {
      hotelName: "La Arbolita",
      roomTitle: "Treehouse 1",
      icalUrl: "https://www.airbnb.com/calendar/ical/1080562355826716736.ics?s=d82953022cafcf04041c47758472f8e7",
      calendarName: "La Arbolita Room 5"
    },
    {
      hotelName: "La Arbolita",
      roomTitle: "Treehouse 2",
      icalUrl: "https://www.airbnb.com/calendar/ical/1030458352976654541.ics?s=ceacbe43de99b862c5e1afd0b2e96c4a",
      calendarName: "La Arbolita Room 6"
    },
    {
      hotelName: "La Arbolita",
      roomTitle: "Treehouse 3",
      icalUrl: "https://www.airbnb.com/calendar/ical/1053572195213481575.ics?s=a85bb8feb2e8dad3a537be26528e25ad",
      calendarName: "La Arbolita Room 7"
    },
  ];

  for (const cal of calendars) {
    const hotel = await prisma.hotel.findFirst({ where: { name: cal.hotelName } });
    if (!hotel) {
      console.warn(`Hotel "${cal.hotelName}" not found. Skipping calendar "${cal.calendarName}"`);
      continue;
    }

    const listing = await prisma.listing.findFirst({
      where: { hotelId: hotel.id, title: cal.roomTitle },
    });

    if (!listing) {
      console.warn(`Listing "${cal.roomTitle}" not found in "${cal.hotelName}". Skipping calendar "${cal.calendarName}"`);
      continue;
    }

    await prisma.calendarSource.upsert({
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


