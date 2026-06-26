import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getHotelCoverCandidates } from "@/lib/hotel-cover";
import { isPortalHost, normalizeHost } from "@/lib/storefront-host";

export type StorefrontHotel = {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  location: string;
  storefrontTagline: string | null;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  description: string;
  descriptionEn: string | null;
  descriptionEs: string | null;
  parallaxImageUrl: string | null;
};

export async function getStorefrontHotel(
  host: string | null | undefined
): Promise<StorefrontHotel | null> {
  const normalized = normalizeHost(host);
  if (!normalized || isPortalHost(normalized)) return null;

  const hotel = await prisma.hotel.findFirst({
    where: { customDomain: normalized },
    select: {
      id: true,
      name: true,
      slug: true,
      customDomain: true,
      location: true,
      storefrontTagline: true,
      logoImageUrl: true,
      coverImageUrl: true,
      description: true,
      descriptionEn: true,
      descriptionEs: true,
      images: { orderBy: { position: "asc" }, select: { url: true } },
    },
  });

  if (!hotel) return null;

  const coverCandidates = getHotelCoverCandidates(hotel);

  return {
    id: hotel.id,
    name: hotel.name,
    slug: hotel.slug,
    customDomain: hotel.customDomain,
    location: hotel.location,
    storefrontTagline: hotel.storefrontTagline,
    logoImageUrl: hotel.logoImageUrl,
    coverImageUrl: hotel.coverImageUrl,
    description: hotel.description,
    descriptionEn: hotel.descriptionEn,
    descriptionEs: hotel.descriptionEs,
    parallaxImageUrl: coverCandidates[0] ?? null,
  };
}

export async function getStorefrontFromHeaders(): Promise<StorefrontHotel | null> {
  const headerStore = await headers();
  return getStorefrontHotel(headerStore.get("x-storefront-host") ?? headerStore.get("host"));
}
