import { prisma } from "./prisma";

export type HotelWithListings = Awaited<ReturnType<typeof getHotelsWithListings>>[number];
export type ListingWithImages = HotelWithListings["listings"][number];
export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingDetail>>>;
export type HotelDetail = NonNullable<Awaited<ReturnType<typeof getHotelDetail>>>;

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
  return Promise.all(
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


