import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSiteUrl, SITE_NAME } from "@/lib/email/config";

export type EmailBrand = {
  hotelName: string;
  siteUrl: string;
  logoUrl: string | null;
  color: string;
  colorDark: string;
  colorSoft: string;
  tagline: string | null;
  location: string | null;
  contactPhone: string | null;
  roomPhotos: string[];
  roomDescription: string | null;
  roomCapacity: number | null;
};

export const DEFAULT_BRAND_COLOR = "#0092A1";

const colorCache = new Map<string, string>();

function hex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(value: string) {
  const v = value.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

export function mixColor(color: string, target: string, amount: number) {
  const a = parseHex(color);
  const b = parseHex(target);
  return hex(a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount);
}

/** Rejects near-white, near-black and gray colors, which make poor accents. */
export function isUsableBrandColor(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (lightness > 225 || lightness < 25) return false;
  return max - min >= 28;
}

export function absoluteUrl(url: string | null | undefined, base: string) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return null;
}

async function readLogo(logoUrl: string): Promise<Buffer | null> {
  if (logoUrl.startsWith("/")) {
    const file = path.join(process.cwd(), "public", path.normalize(logoUrl).replace(/^([/\\])+/, ""));
    return readFile(file).catch(() => null);
  }
  if (!/^https:\/\//i.test(logoUrl)) return null;
  const res = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!res?.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Dominant color of the hotel's logo, or the Aldeitas teal when it can't be read. */
export async function logoBrandColor(logoUrl: string | null): Promise<string> {
  if (!logoUrl) return DEFAULT_BRAND_COLOR;
  const cached = colorCache.get(logoUrl);
  if (cached) return cached;

  let color = DEFAULT_BRAND_COLOR;
  try {
    const input = await readLogo(logoUrl);
    if (input) {
      const { default: sharp } = await import("sharp");
      const { dominant } = await sharp(input).stats();
      if (isUsableBrandColor(dominant.r, dominant.g, dominant.b)) {
        color = hex(dominant.r, dominant.g, dominant.b);
      }
    }
  } catch (error) {
    console.warn("[email] could not read logo color", logoUrl, error);
  }
  colorCache.set(logoUrl, color);
  return color;
}

export function hotelSiteUrl(customDomain: string | null | undefined) {
  const domain = customDomain?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return domain ? `https://${domain}` : getSiteUrl();
}

export async function loadEmailBrand(listingId: string): Promise<EmailBrand> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      descriptionEs: true,
      description: true,
      guestsInBeds: true,
      guestsInBedsAndSofas: true,
      images: { orderBy: { position: "asc" }, take: 3, select: { url: true } },
      hotel: {
        select: {
          name: true,
          customDomain: true,
          logoImageUrl: true,
          storefrontTagline: true,
          location: true,
          mainContactNumber: true,
        },
      },
    },
  });

  const hotel = listing?.hotel;
  const siteUrl = hotelSiteUrl(hotel?.customDomain);
  const color = await logoBrandColor(hotel?.logoImageUrl ?? null);

  return {
    hotelName: hotel?.name || SITE_NAME,
    siteUrl,
    logoUrl: absoluteUrl(hotel?.logoImageUrl, siteUrl),
    color,
    colorDark: mixColor(color, "#111111", 0.35),
    colorSoft: mixColor(color, "#ffffff", 0.9),
    tagline: hotel?.storefrontTagline?.trim() || null,
    location: hotel?.location?.trim() || null,
    contactPhone: hotel?.mainContactNumber?.trim() || null,
    roomPhotos: (listing?.images ?? [])
      .map((image) => absoluteUrl(image.url, siteUrl))
      .filter((url): url is string => Boolean(url)),
    roomDescription: (listing?.descriptionEs || listing?.description)?.trim() || null,
    roomCapacity: listing?.guestsInBedsAndSofas ?? listing?.guestsInBeds ?? null,
  };
}
