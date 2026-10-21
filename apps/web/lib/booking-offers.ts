import type { BookingOffer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listOfferedAddons, offerAddonCatalog } from "@/lib/addons";

const DAY_MS = 24 * 60 * 60 * 1000;

export type OfferTerms = Pick<
  BookingOffer,
  "startDate" | "endDate" | "nightlyCents" | "cleaningFeeCents" | "discountPercent"
>;

/** Stay price for an offer: nights plus cleaning, less the offer's discount. */
export function offerPrice(offer: OfferTerms) {
  const nights = Math.max(0, Math.round((offer.endDate.getTime() - offer.startDate.getTime()) / DAY_MS));
  const staysCents = nights * offer.nightlyCents;
  const subtotalCents = staysCents + offer.cleaningFeeCents;
  const discountCents = Math.round((subtotalCents * offer.discountPercent) / 100);
  return { nights, staysCents, subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}

export function offerAddonIds(offer: Pick<BookingOffer, "addonIds">): string[] | null {
  if (!offer.addonIds) return null;
  try {
    const ids: unknown = JSON.parse(offer.addonIds);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : null;
  } catch {
    return null;
  }
}

/** Offer for a token, with its room and hotel; null when unknown or expired. */
export async function findActiveOffer(token: string) {
  const offer = await prisma.bookingOffer.findUnique({
    where: { token },
    include: {
      listing: {
        include: {
          hotel: { select: { id: true, name: true } },
          images: { orderBy: { position: "asc" }, take: 3 },
        },
      },
    },
  });
  if (!offer || (offer.expiresAt && offer.expiresAt.getTime() < Date.now())) return null;
  return offer;
}

/** Extras shown at an offer's checkout: the owner's picks, or the hotel's usual list. */
export async function listOfferAddons(offer: BookingOffer & { listing: { hotelId: string } }) {
  const ids = offerAddonIds(offer);
  return ids
    ? offerAddonCatalog(offer.listing.hotelId, offer.listingId, offer.startDate, offer.endDate, ids)
    : listOfferedAddons(offer.listing.hotelId, offer.listingId, offer.startDate, offer.endDate);
}

export function offerDateKeys(offer: Pick<BookingOffer, "startDate" | "endDate">) {
  return { start: offer.startDate.toISOString().slice(0, 10), end: offer.endDate.toISOString().slice(0, 10) };
}
