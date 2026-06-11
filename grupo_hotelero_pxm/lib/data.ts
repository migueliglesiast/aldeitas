import { prisma } from "./prisma";

export async function getHotelsWithListings() {
  return prisma.hotel.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { position: "asc" } },
      listings: {
        include: { images: { orderBy: { position: "asc" } } },
      },
    },
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
      images: { orderBy: { position: "asc" } },
      listings: {
        include: { images: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}


