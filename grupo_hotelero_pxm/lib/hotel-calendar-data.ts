import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { fetchIcalBlocks } from "@/lib/airbnb";
import {
  getHotelCalendarWindow,
  listDateKeys,
  parseDateKey,
  rangesOverlap,
  toDateKey,
} from "@/lib/calendar-dates";
import { getListingDailyPriceMap } from "@/lib/listing-pricing";
import { manualBlockCoversNight } from "@/lib/manual-blocks";

export type CalendarCellStatus =
  | "available"
  | "manual_block"
  | "booking"
  | "external";

export type CalendarCell = {
  status: CalendarCellStatus;
  priceCents: number;
  priceOverride: boolean;
  blockId?: string;
  bookingId?: string;
  bookingStatus?: string;
  guestEmail?: string;
  guestPhone?: string;
  label?: string;
};

export type HotelCalendarRoom = {
  id: string;
  title: string;
  nightlyBasePrice: number;
  baseCurrency: string;
  cells: Record<string, CalendarCell>;
};

export type HotelCalendarPayload = {
  hotel: { id: string; name: string; location: string };
  startDate: string;
  endDate: string;
  days: string[];
  rooms: HotelCalendarRoom[];
  readOnly: boolean;
};

type BuildOptions = {
  includeGuestDetails?: boolean;
  readOnly?: boolean;
  months?: number;
};

function nightRangeEnd(startKey: string) {
  const end = parseDateKey(startKey);
  end.setDate(end.getDate() + 1);
  return end;
}

function bookingCoversNight(
  booking: { startDate: Date; endDate: Date },
  nightKey: string
) {
  return rangesOverlap(
    booking.startDate,
    booking.endDate,
    parseDateKey(nightKey),
    nightRangeEnd(nightKey)
  );
}

function externalCoversNight(
  block: { start: Date; end: Date },
  nightKey: string
) {
  return rangesOverlap(
    block.start,
    block.end,
    parseDateKey(nightKey),
    nightRangeEnd(nightKey)
  );
}

async function fetchExternalBlocks(listing: {
  icalUrl: string | null;
  calendarSources: { icalUrl: string; name: string }[];
}) {
  const blocks: Array<{ start: Date; end: Date; name: string }> = [];
  const sources = [
    ...(listing.icalUrl ? [{ name: "Airbnb", icalUrl: listing.icalUrl }] : []),
    ...listing.calendarSources.map((source) => ({
      name: source.name,
      icalUrl: source.icalUrl,
    })),
  ];

  for (const source of sources) {
    try {
      const fetched = await fetchIcalBlocks(source.icalUrl);
      blocks.push(
        ...fetched.map((block) => ({
          start: block.start,
          end: block.end,
          name: source.name,
        }))
      );
    } catch (error) {
      console.error(`[hotel-calendar] failed to fetch ${source.name}:`, error);
    }
  }

  return blocks;
}

export async function buildHotelCalendarData(
  hotelId: string,
  options: BuildOptions = {}
): Promise<HotelCalendarPayload | null> {
  const { start, end } = getHotelCalendarWindow(options.months);
  const days = listDateKeys(start, end);
  const rangeEndExclusive = new Date(end);
  rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    include: {
      listings: {
        orderBy: { createdAt: "asc" },
        include: {
          calendarSources: true,
          bookings: {
            where: {
              NOT: [
                { endDate: { lte: start } },
                { startDate: { gte: rangeEndExclusive } },
              ],
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            orderBy: { startDate: "asc" },
          },
          manualBlocks: {
            where: {
              NOT: [
                { endDate: { lte: start } },
                { startDate: { gte: rangeEndExclusive } },
              ],
            },
            orderBy: { startDate: "asc" },
          },
        },
      },
    },
  });

  if (!hotel) return null;

  const rooms: HotelCalendarRoom[] = [];

  for (const listing of hotel.listings) {
    const dailyPrices = await getListingDailyPriceMap(
      listing.id,
      start,
      rangeEndExclusive
    );
    const externalBlocks = await fetchExternalBlocks(listing);
    const cells: Record<string, CalendarCell> = {};

    for (const day of days) {
      const priceOverride = dailyPrices.has(day);
      const priceCents = dailyPrices.get(day) ?? listing.nightlyBasePrice;

      const booking = listing.bookings.find((item) => bookingCoversNight(item, day));

      if (booking) {
        cells[day] = {
          status: "booking",
          priceCents,
          priceOverride,
          bookingId: booking.id,
          bookingStatus: booking.status,
          guestEmail: options.includeGuestDetails ? booking.guestEmail : undefined,
          guestPhone: options.includeGuestDetails ? booking.guestPhone : undefined,
          label:
            booking.status === "CONFIRMED"
              ? "Booked"
              : booking.authorizedAt
                ? "Processing"
                : "Awaiting payment",
        };
        continue;
      }

      const manualBlock = listing.manualBlocks.find((block) =>
        manualBlockCoversNight(block, parseDateKey(day))
      );

      if (manualBlock) {
        cells[day] = {
          status: "manual_block",
          priceCents,
          priceOverride,
          blockId: manualBlock.id,
          label: "Blocked",
        };
        continue;
      }

      const external = externalBlocks.find((block) => externalCoversNight(block, day));
      if (external) {
        cells[day] = {
          status: "external",
          priceCents,
          priceOverride,
          label: "External",
        };
        continue;
      }

      cells[day] = {
        status: "available",
        priceCents,
        priceOverride,
        label: "Available",
      };
    }

    rooms.push({
      id: listing.id,
      title: listing.title,
      nightlyBasePrice: listing.nightlyBasePrice,
      baseCurrency: listing.baseCurrency,
      cells,
    });
  }

  return {
    hotel: {
      id: hotel.id,
      name: hotel.name,
      location: hotel.location,
    },
    startDate: toDateKey(start),
    endDate: toDateKey(end),
    days,
    rooms,
    readOnly: options.readOnly ?? false,
  };
}

export async function getOrCreateHotelCalendarShareToken(hotelId: string) {
  const existing = await prisma.hotelCalendarShare.findUnique({
    where: { hotelId },
  });
  if (existing) return existing;

  return prisma.hotelCalendarShare.create({
    data: {
      hotelId,
      token: randomBytes(24).toString("hex"),
    },
  });
}

export async function getHotelIdForShareToken(token: string) {
  const share = await prisma.hotelCalendarShare.findUnique({
    where: { token },
    select: { hotelId: true },
  });
  return share?.hotelId ?? null;
}

export function getHotelCalendarShareUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}/calendar/${token}`;
}
