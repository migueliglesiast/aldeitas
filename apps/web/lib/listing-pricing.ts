import { prisma } from "@/lib/prisma";
import { dateKeysForRange, parseDateKey, toDateKey } from "@/lib/calendar-dates";

export async function getListingDailyPriceMap(
  listingId: string,
  start: Date,
  end: Date
) {
  const prices = await prisma.listingDailyPrice.findMany({
    where: {
      listingId,
      date: {
        gte: start,
        lt: end,
      },
    },
  });

  const map = new Map<string, number>();
  for (const price of prices) {
    map.set(toDateKey(price.date), price.priceCents);
  }
  return map;
}

export async function getNightlyPriceCents(
  listingId: string,
  night: Date,
  basePriceCents: number
) {
  const row = await prisma.listingDailyPrice.findUnique({
    where: {
      listingId_date: {
        listingId,
        date: parseDateKey(toDateKey(night)),
      },
    },
  });
  return row?.priceCents ?? basePriceCents;
}

export async function calculateStayTotalCents(params: {
  listingId: string;
  basePriceCents: number;
  startDate: Date;
  endDate: Date;
}) {
  const nightlyPrices = await getListingDailyPriceMap(
    params.listingId,
    params.startDate,
    params.endDate
  );
  const nights = dateKeysForRange(params.startDate, params.endDate);
  let total = 0;
  for (const nightKey of nights) {
    total += nightlyPrices.get(nightKey) ?? params.basePriceCents;
  }
  return { nights: nights.length, totalCents: total };
}
