import { prisma } from "./prisma";

export async function getHotelsWithListings() {
  // Use raw query to get all hotel data including googleMapsUrl
  const hotelsRaw = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    description: string;
    location: string;
    googleMapsUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>>`
    SELECT id, name, description, location, googleMapsUrl, createdAt, updatedAt 
    FROM Hotel 
    ORDER BY createdAt DESC
  `;
  
  // Get listings for each hotel
  const hotelsWithListings = await Promise.all(
    hotelsRaw.map(async (hotel) => {
      const listings = await prisma.listing.findMany({
        where: { hotelId: hotel.id },
        include: { images: { orderBy: { position: "asc" } } },
      });
      
      return {
        ...hotel,
        listings,
      };
    })
  );
  
  // Debug logging removed for production - uncomment if needed for debugging
  // console.log('🔍 SERVER: Hotels fetched from database');
  // hotelsWithListings.forEach(h => {
  //   const url = h.googleMapsUrl;
  //   console.log(`  ${h.name}: ${url ? `HAS URL (${url?.length || 0} chars)` : 'NO URL'}`);
  // });
  
  return hotelsWithListings;
}

export async function getListingDetail(id: string) {
  return prisma.listing.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      hotel: true,
    },
  });
}

export async function getHotelDetail(id: string) {
  return prisma.hotel.findUnique({
    where: { id },
    include: {
      listings: {
        include: { images: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}


