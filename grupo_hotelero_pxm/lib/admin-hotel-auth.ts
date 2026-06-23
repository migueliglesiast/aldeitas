import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireHotelManager(hotelId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized" as const, status: 401 as const };
  }

  const manager = await prisma.hotelManager.findFirst({
    where: { userId: user.id, hotelId },
    select: { id: true },
  });

  if (!manager) {
    return { error: "Unauthorized" as const, status: 403 as const };
  }

  return { user };
}

export async function requireManagedListing(listingId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized" as const, status: 401 as const };
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      hotel: {
        include: {
          managers: {
            where: { userId: user.id },
          },
        },
      },
    },
  });

  if (!listing) {
    return { error: "Room not found" as const, status: 404 as const };
  }

  if (listing.hotel.managers.length === 0) {
    return { error: "Unauthorized" as const, status: 403 as const };
  }

  return { user, listing };
}
