import { prisma } from "@/lib/prisma";
import { resolveListingAirbnbId } from "@/lib/airbnb-listing-id";
import { fetchAirbnbDailyPriceMap } from "@/lib/airbnb-prices";
import { parseDateKey } from "@/lib/calendar-dates";
import { SITE_CURRENCY } from "@/lib/currency";

export type SyncAirbnbPricesResult = {
  hotelId: string;
  hotelName: string;
  rooms: Array<{
    listingId: string;
    title: string;
    airbnbListingId: string | null;
    updatedDays: number;
    basePriceCents: number | null;
    samples: number;
    errors: number;
    skippedReason?: string;
  }>;
};

function listingLooksLinkedToAirbnb(listing: {
  airbnbId?: string | null;
  airbnbUrl?: string | null;
  icalUrl?: string | null;
  calendarSources?: Array<{ icalUrl: string }>;
}) {
  return Boolean(resolveListingAirbnbId(listing));
}

/** Hotels that have at least one Airbnb-linked room, oldest price sync first. */
export async function listHotelsForAirbnbPriceSync() {
  const hotels = await prisma.hotel.findMany({
    include: {
      listings: {
        include: {
          calendarSources: true,
          dailyPrices: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { updatedAt: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return hotels
    .map((hotel) => {
      const linkedListings = hotel.listings.filter(listingLooksLinkedToAirbnb);
      if (linkedListings.length === 0) return null;

      const lastSyncedAt = linkedListings.reduce<Date | null>((oldest, listing) => {
        const stamp = listing.dailyPrices[0]?.updatedAt ?? null;
        if (!stamp) return oldest;
        if (!oldest || stamp < oldest) return stamp;
        return oldest;
      }, null);

      return {
        id: hotel.id,
        name: hotel.name,
        linkedRooms: linkedListings.length,
        lastSyncedAt,
      };
    })
    .filter((hotel): hotel is NonNullable<typeof hotel> => Boolean(hotel))
    .sort((a, b) => {
      if (!a.lastSyncedAt && !b.lastSyncedAt) return a.name.localeCompare(b.name);
      if (!a.lastSyncedAt) return -1;
      if (!b.lastSyncedAt) return 1;
      return a.lastSyncedAt.getTime() - b.lastSyncedAt.getTime();
    });
}

export async function syncHotelAirbnbPrices(
  hotelId: string,
  options: { months?: number; sampleEvery?: number } = {}
): Promise<SyncAirbnbPricesResult> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    include: {
      listings: {
        orderBy: { createdAt: "asc" },
        include: { calendarSources: true },
      },
    },
  });

  if (!hotel) {
    throw new Error("Hotel not found");
  }

  const rooms: SyncAirbnbPricesResult["rooms"] = [];

  for (const listing of hotel.listings) {
    const airbnbListingId = resolveListingAirbnbId(listing);
    if (!airbnbListingId) {
      rooms.push({
        listingId: listing.id,
        title: listing.title,
        airbnbListingId: null,
        updatedDays: 0,
        basePriceCents: null,
        samples: 0,
        errors: 0,
        skippedReason: "No Airbnb listing ID (add Airbnb URL or iCal link)",
      });
      continue;
    }

    // Keep airbnbId in sync with the real numeric ID when we discover it.
    if (listing.airbnbId !== airbnbListingId) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { airbnbId: airbnbListingId },
      });
    }

    const { prices, samples, errors } = await fetchAirbnbDailyPriceMap(
      airbnbListingId,
      {
        months: options.months ?? 3,
        sampleEvery: options.sampleEvery ?? 3,
        currency: listing.baseCurrency || SITE_CURRENCY,
      }
    );

    let updatedDays = 0;
    for (const [dateKey, priceCents] of prices) {
      const date = parseDateKey(dateKey);
      await prisma.listingDailyPrice.upsert({
        where: {
          listingId_date: {
            listingId: listing.id,
            date,
          },
        },
        update: {
          priceCents,
          currency: listing.baseCurrency || SITE_CURRENCY,
        },
        create: {
          listingId: listing.id,
          date,
          priceCents,
          currency: listing.baseCurrency || SITE_CURRENCY,
        },
      });
      updatedDays += 1;
    }

    const values = [...prices.values()];
    const basePriceCents =
      values.length > 0
        ? values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)]
        : null;

    if (basePriceCents != null) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { nightlyBasePrice: basePriceCents },
      });
    }

    rooms.push({
      listingId: listing.id,
      title: listing.title,
      airbnbListingId,
      updatedDays,
      basePriceCents,
      samples,
      errors,
    });
  }

  return { hotelId, hotelName: hotel.name, rooms };
}

/**
 * Sync one hotel per call (stalest first) so cron-job.org timeouts stay happy.
 * Full portfolio rotates across hourly/daily hits.
 */
export async function syncNextHotelAirbnbPrices(
  options: { months?: number; sampleEvery?: number; hotelId?: string } = {}
) {
  const queue = await listHotelsForAirbnbPriceSync();
  if (queue.length === 0) {
    return {
      ok: true as const,
      synced: null,
      remaining: 0,
      message: "No hotels with Airbnb-linked rooms.",
    };
  }

  const target =
    (options.hotelId
      ? queue.find((hotel) => hotel.id === options.hotelId)
      : null) ?? queue[0];

  if (options.hotelId && !queue.some((hotel) => hotel.id === options.hotelId)) {
    throw new Error("Hotel not found or has no Airbnb-linked rooms");
  }

  const result = await syncHotelAirbnbPrices(target.id, {
    months: options.months ?? 3,
    sampleEvery: options.sampleEvery ?? 3,
  });

  const updatedRooms = result.rooms.filter((room) => room.updatedDays > 0).length;
  return {
    ok: true as const,
    synced: result,
    remaining: Math.max(0, queue.length - 1),
    message: `Synced ${result.hotelName}: ${updatedRooms}/${result.rooms.length} rooms updated.`,
  };
}
