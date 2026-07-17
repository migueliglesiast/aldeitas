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
  guestName?: string;
  guestCount?: number | null;
  spanId?: string;
  label?: string;
};

export type CalendarSpan = {
  id: string;
  kind: "booking" | "external" | "manual_block";
  startDay: string;
  /** Inclusive last night key covered by this reservation/block. */
  endDay: string;
  /** Exclusive checkout date key (for saving guest meta against iCal ranges). */
  checkoutDay: string;
  /** True reservation start (may be before the visible window). */
  rangeStartDay: string;
  dayCount: number;
  label: string;
  guestName?: string;
  guestCount?: number | null;
  bookingId?: string;
  bookingStatus?: string;
  blockId?: string;
  sourceUid?: string;
};

export type HotelCalendarRoom = {
  id: string;
  title: string;
  nightlyBasePrice: number;
  baseCurrency: string;
  cells: Record<string, CalendarCell>;
  spans: CalendarSpan[];
};

export type HotelCalendarPayload = {
  hotel: { id: string; name: string; location: string };
  startDate: string;
  endDate: string;
  days: string[];
  rooms: HotelCalendarRoom[];
  readOnly: boolean;
  shareUrl?: string | null;
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

function guestNameFromEmail(email: string) {
  const local = email.split("@")[0] || email;
  const cleaned = local.replace(/[._+\-]+/g, " ").trim();
  if (!cleaned) return "Guest";
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function addDaysKey(dateKey: string, daysToAdd: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + daysToAdd);
  return toDateKey(date);
}

/** Parse guest name + count from iCal SUMMARY/DESCRIPTION when a PMS provides them. */
export function parseIcalGuestDetails(summary?: string, description?: string) {
  const text = [summary, description].filter(Boolean).join("\n").trim();
  if (!text) {
    return { guestName: null as string | null, guestCount: null as number | null };
  }

  const lowered = text.toLowerCase();
  const isGenericReserved =
    /^(reserved|blocked|unavailable|not available|closed)\b/i.test(text.trim()) ||
    lowered === "reserved" ||
    lowered.startsWith("reserved\n");

  const countMatch =
    text.match(
      /(\d+)\s*(?:guests?|huéspedes?|huespedes?|adults?|personas?)\b/i
    ) || text.match(/\((\d+)\s*(?:guests?|huéspedes?|huespedes?)\)/i);
  const guestCount = countMatch ? Number(countMatch[1]) : null;

  let guestName: string | null = null;
  if (!isGenericReserved) {
    const summaryLine = (summary || "").trim();
    const withoutCount = summaryLine
      .replace(/\s*[\-(]?\s*\d+\s*(?:guests?|huéspedes?|huespedes?|adults?|personas?)\s*[\)]?\s*$/i, "")
      .replace(/^reserved\s*[-:–]\s*/i, "")
      .trim();
    if (
      withoutCount &&
      !/^(reserved|blocked|unavailable|airbnb|external)/i.test(withoutCount) &&
      !/^room\s*\d+/i.test(withoutCount)
    ) {
      guestName = withoutCount;
    }
  }

  return {
    guestName,
    guestCount:
      guestCount != null && Number.isFinite(guestCount) && guestCount > 0
        ? guestCount
        : null,
  };
}

function nightsForRange(
  days: string[],
  covers: (nightKey: string) => boolean
): string[] {
  return days.filter(covers);
}

function buildSpanFromNights(
  nights: string[],
  partial: Omit<
    CalendarSpan,
    "startDay" | "endDay" | "dayCount" | "checkoutDay" | "rangeStartDay"
  > & {
    checkoutDay?: string;
    rangeStartDay?: string;
  }
): CalendarSpan | null {
  if (nights.length === 0) return null;
  const endDay = nights[nights.length - 1];
  return {
    ...partial,
    startDay: nights[0],
    endDay,
    rangeStartDay: partial.rangeStartDay || nights[0],
    checkoutDay: partial.checkoutDay || addDaysKey(endDay, 1),
    dayCount: nights.length,
  };
}

async function fetchExternalBlocks(listing: {
  icalUrl: string | null;
  calendarSources: { icalUrl: string; name: string }[];
}) {
  const blocks: Array<{
    start: Date;
    end: Date;
    name: string;
    summary?: string;
    description?: string;
    uid?: string;
  }> = [];
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
          summary: block.summary,
          description: block.description,
          uid: block.uid,
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
          guestMetas: true,
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
    const spans: CalendarSpan[] = [];
    const guestMetaByRange = new Map(
      listing.guestMetas.map((meta) => [
        `${toDateKey(meta.startDate)}|${toDateKey(meta.endDate)}`,
        meta,
      ])
    );
    const guestMetaByUid = new Map(
      listing.guestMetas
        .filter((meta) => meta.sourceUid)
        .map((meta) => [meta.sourceUid as string, meta])
    );

    for (const booking of listing.bookings) {
      const nights = nightsForRange(days, (nightKey) =>
        bookingCoversNight(booking, nightKey)
      );
      const guestName =
        booking.guestName?.trim() || guestNameFromEmail(booking.guestEmail);
      const guestCount = booking.guestCount ?? null;
      const span = buildSpanFromNights(nights, {
        id: `booking-${booking.id}`,
        kind: "booking",
        label:
          booking.status === "CONFIRMED"
            ? "Confirmed"
            : booking.authorizedAt
              ? "Processing"
              : "Awaiting payment",
        guestName,
        guestCount,
        bookingId: booking.id,
        bookingStatus: booking.status,
        checkoutDay: toDateKey(booking.endDate),
        rangeStartDay: toDateKey(booking.startDate),
      });
      if (span) spans.push(span);
    }

    for (const block of listing.manualBlocks) {
      const nights = nightsForRange(days, (nightKey) =>
        manualBlockCoversNight(block, parseDateKey(nightKey))
      );
      const span = buildSpanFromNights(nights, {
        id: `block-${block.id}`,
        kind: "manual_block",
        label: "Blocked",
        blockId: block.id,
        checkoutDay: toDateKey(block.endDate),
        rangeStartDay: toDateKey(block.startDate),
      });
      if (span) spans.push(span);
    }

    externalBlocks.forEach((block, index) => {
      const nights = nightsForRange(days, (nightKey) =>
        externalCoversNight(block, nightKey)
      );
      if (nights.length === 0) return;

      const rangeStartDay = toDateKey(block.start);
      const checkoutDay = toDateKey(block.end);
      const rangeKey = `${rangeStartDay}|${checkoutDay}`;
      const saved =
        (block.uid ? guestMetaByUid.get(block.uid) : undefined) ||
        guestMetaByRange.get(rangeKey);
      const parsed = parseIcalGuestDetails(block.summary, block.description);

      const guestName =
        saved?.guestName?.trim() ||
        parsed.guestName ||
        "Airbnb guest";
      const guestCount = saved?.guestCount ?? parsed.guestCount ?? null;

      const span = buildSpanFromNights(nights, {
        id: `external-${listing.id}-${index}-${nights[0]}`,
        kind: "external",
        label: "External",
        guestName,
        guestCount,
        checkoutDay,
        rangeStartDay,
        sourceUid: block.uid,
      });
      if (span) spans.push(span);
    });

    for (const day of days) {
      const priceOverride = dailyPrices.has(day);
      const priceCents = dailyPrices.get(day) ?? listing.nightlyBasePrice;

      const booking = listing.bookings.find((item) =>
        bookingCoversNight(item, day)
      );

      if (booking) {
        const guestName =
          booking.guestName?.trim() || guestNameFromEmail(booking.guestEmail);
        const guestCount = booking.guestCount ?? null;
        cells[day] = {
          status: "booking",
          priceCents,
          priceOverride,
          bookingId: booking.id,
          bookingStatus: booking.status,
          guestEmail: options.includeGuestDetails ? booking.guestEmail : undefined,
          guestPhone: options.includeGuestDetails ? booking.guestPhone : undefined,
          guestName,
          guestCount,
          spanId: `booking-${booking.id}`,
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
          spanId: `block-${manualBlock.id}`,
          label: "Blocked",
        };
        continue;
      }

      const externalIndex = externalBlocks.findIndex((block) =>
        externalCoversNight(block, day)
      );
      if (externalIndex >= 0) {
        const external = externalBlocks[externalIndex];
        const nights = nightsForRange(days, (nightKey) =>
          externalCoversNight(external, nightKey)
        );
        const checkoutDay = toDateKey(external.end);
        const rangeKey = `${toDateKey(external.start)}|${checkoutDay}`;
        const saved =
          (external.uid ? guestMetaByUid.get(external.uid) : undefined) ||
          guestMetaByRange.get(rangeKey);
        const parsed = parseIcalGuestDetails(
          external.summary,
          external.description
        );
        const guestName =
          saved?.guestName?.trim() || parsed.guestName || "Airbnb guest";
        const guestCount = saved?.guestCount ?? parsed.guestCount ?? null;
        cells[day] = {
          status: "external",
          priceCents,
          priceOverride,
          guestName,
          guestCount,
          spanId: `external-${listing.id}-${externalIndex}-${nights[0] || externalIndex}`,
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
      spans,
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
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}/calendar/${token}`;
}
