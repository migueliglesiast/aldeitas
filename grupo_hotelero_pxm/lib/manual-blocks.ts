import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rangesOverlap } from "@/lib/calendar-dates";

export function manualBlockWhere(
  listingId: string,
  startDate: Date,
  endDate: Date
): Prisma.ManualBlockWhereInput {
  return {
    listingId,
    NOT: [{ endDate: { lte: startDate } }, { startDate: { gte: endDate } }],
  };
}

export async function hasManualBlockConflict(
  listingId: string,
  startDate: Date,
  endDate: Date
) {
  const count = await prisma.manualBlock.count({
    where: manualBlockWhere(listingId, startDate, endDate),
  });
  return count > 0;
}

export async function getManualBlocksForListing(
  listingId: string,
  rangeStart: Date,
  rangeEnd: Date
) {
  return prisma.manualBlock.findMany({
    where: {
      listingId,
      NOT: [{ endDate: { lte: rangeStart } }, { startDate: { gte: rangeEnd } }],
    },
    orderBy: { startDate: "asc" },
  });
}

export function manualBlockCoversNight(
  block: { startDate: Date; endDate: Date },
  night: Date
) {
  const nextNight = new Date(night);
  nextNight.setDate(nextNight.getDate() + 1);
  return rangesOverlap(block.startDate, block.endDate, night, nextNight);
}
