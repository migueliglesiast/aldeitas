import { prisma } from "./prisma";

export type HotelWithListings = Awaited<ReturnType<typeof getHotelsWithListings>>[number];
export type ListingWithImages = HotelWithListings["listings"][number];
export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingDetail>>>;
export type HotelDetail = NonNullable<Awaited<ReturnType<typeof getHotelDetail>>>;

export async function getHotelsWithListings() {
  return prisma.hotel.findMany({
    include: {
      listings: {
        include: { images: { orderBy: { position: "asc" } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
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


