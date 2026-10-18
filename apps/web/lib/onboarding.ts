import { prisma } from "@/lib/prisma";
import {
  getHotelCalendarShareUrl,
  getOrCreateHotelCalendarShareToken,
} from "@/lib/hotel-calendar-data";

export const ONBOARDING_STEPS = [
  "you",
  "story",
  "map",
  "inbox",
  "airbnb",
  "calendars",
  "team",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingRoom = {
  id: string;
  title: string;
  airbnbUrl: string;
  hasDescription: boolean;
  imageCount: number;
  calendarCount: number;
};

export type OnboardingState = {
  user: { nickname: string; fullName: string; phoneNumber: string };
  hotel: {
    id: string;
    name: string;
    description: string;
    location: string;
    googleMapsUrl: string;
    latitude: number | null;
    longitude: number | null;
    gmailEmail: string;
    gmailConnected: boolean;
  } | null;
  rooms: OnboardingRoom[];
  cleaner: { name: string; phone: string } | null;
  maintenance: { name: string; phone: string } | null;
  publicCalendarUrl: string | null;
  ownerCalendarUrl: string | null;
  missing: OnboardingStep[];
};

export function roomHasAirbnb(room: OnboardingRoom) {
  return Boolean(room.airbnbUrl) && room.imageCount > 0;
}

export function roomHasCalendar(room: OnboardingRoom) {
  return room.calendarCount > 0;
}

/** The hotel onboarding works on: the first one the user manages. */
export async function getPrimaryHotelId(userId: string) {
  const manager = await prisma.hotelManager.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { hotelId: true },
  });
  return manager?.hotelId ?? null;
}

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { nickname: true, fullName: true, phoneNumber: true },
  });
  const hotelId = await getPrimaryHotelId(userId);
  const hotel = hotelId
    ? await prisma.hotel.findUnique({
        where: { id: hotelId },
        include: {
          listings: {
            orderBy: { createdAt: "asc" },
            include: { _count: { select: { images: true, calendarSources: true } } },
          },
          contacts: { orderBy: { createdAt: "asc" } },
        },
      })
    : null;

  const rooms: OnboardingRoom[] = (hotel?.listings ?? []).map((listing) => ({
    id: listing.id,
    title: listing.title,
    airbnbUrl: listing.airbnbUrl,
    hasDescription: Boolean(listing.description?.trim()),
    imageCount: listing._count.images,
    calendarCount: listing._count.calendarSources + (listing.icalUrl ? 1 : 0),
  }));

  const contact = (type: string) => {
    const found = hotel?.contacts.find((c) => c.type === type);
    return found ? { name: found.name, phone: found.phone } : null;
  };
  const cleaner = contact("CLEANER");
  const maintenance = contact("MAIN_MAINTENANCE");

  let publicCalendarUrl: string | null = null;
  if (hotel) {
    const share = await getOrCreateHotelCalendarShareToken(hotel.id);
    publicCalendarUrl = getHotelCalendarShareUrl(share.token);
  }

  const missing: OnboardingStep[] = [];
  if (!user.nickname || !user.phoneNumber) missing.push("you");
  if (hotel) {
    if (!hotel.description.trim()) missing.push("story");
    if (!hotel.location.trim() || hotel.latitude == null || hotel.longitude == null) {
      missing.push("map");
    }
    if (!(hotel.gmailSyncEmail && hotel.gmailSyncPasswordEnc)) missing.push("inbox");
    if (rooms.length === 0 || rooms.some((room) => !roomHasAirbnb(room))) missing.push("airbnb");
    if (rooms.some((room) => !roomHasCalendar(room))) missing.push("calendars");
    if (!cleaner) missing.push("team");
  }

  return {
    user: {
      nickname: user.nickname ?? "",
      fullName: user.fullName ?? "",
      phoneNumber: user.phoneNumber ?? "",
    },
    hotel: hotel
      ? {
          id: hotel.id,
          name: hotel.name,
          description: hotel.description,
          location: hotel.location,
          googleMapsUrl: hotel.googleMapsUrl ?? "",
          latitude: hotel.latitude,
          longitude: hotel.longitude,
          gmailEmail: hotel.gmailSyncEmail ?? "",
          gmailConnected: Boolean(hotel.gmailSyncEmail && hotel.gmailSyncPasswordEnc),
        }
      : null,
    rooms,
    cleaner,
    maintenance,
    publicCalendarUrl,
    ownerCalendarUrl: publicCalendarUrl ? `${publicCalendarUrl}/owner` : null,
    missing,
  };
}

const COORD = String.raw`(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)`;
const COORD_PATTERNS = [
  new RegExp(String.raw`!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)`),
  new RegExp(String.raw`@${COORD}`),
  new RegExp(String.raw`[?&](?:q|query|ll|destination)=${COORD}`),
  new RegExp(String.raw`^\s*${COORD}\s*$`),
];

export function parseCoordinates(input: string): { latitude: number; longitude: number } | null {
  const text = decodeURIComponent(input.replace(/\+/g, " "));
  for (const pattern of COORD_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return { latitude, longitude };
    }
  }
  return null;
}

const MAPS_HOSTS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "google.com",
  "www.google.com",
  "maps.google.com",
  "google.com.mx",
  "www.google.com.mx",
]);

function isMapsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && MAPS_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Follows Google Maps short links (only to Google hosts) until the coordinates show up. */
export async function resolveMapsCoordinates(input: string) {
  const direct = parseCoordinates(input);
  if (direct) return direct;

  let current = input.trim();
  for (let hop = 0; hop < 4 && isMapsUrl(current); hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    const location = res.headers.get("location");
    if (!location) break;
    current = new URL(location, current).toString();
    const found = parseCoordinates(current);
    if (found) return found;
  }
  return null;
}
