import { prisma } from "./prisma";
import { guestPriceCents } from "./price-split";

function withGuestPrice<T extends { nightlyBasePrice: number }>(listing: T): T {
  if (typeof listing.nightlyBasePrice !== "number") return listing;
  return { ...listing, nightlyBasePrice: guestPriceCents(listing.nightlyBasePrice) };
}

export type HotelWithListings = Awaited<ReturnType<typeof getHotelsWithListings>>[number];
export type ListingWithImages = HotelWithListings["listings"][number];
export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingDetail>>>;
export type HotelDetail = NonNullable<Awaited<ReturnType<typeof getHotelDetail>>>;

export async function getHotelsWithListings() {
  const hotels = await prisma.hotel.findMany({
    include: {
      listings: {
        include: { images: { orderBy: { position: "asc" } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return hotels.map((hotel) => ({ ...hotel, listings: hotel.listings.map(withGuestPrice) }));
}

export async function getListingDetail(id: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      hotel: true,
    },
  });
  return listing ? withGuestPrice(listing) : null;
}

export async function getHotelDetail(id: string) {
  const hotel = await prisma.hotel.findUnique({
    where: { id },
    include: {
      listings: {
        include: { images: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return hotel ? { ...hotel, listings: hotel.listings.map(withGuestPrice) } : null;
}
