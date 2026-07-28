import { prisma } from "@/lib/prisma";
import { fetchIcalBlocks } from "@/lib/airbnb";
import { parseDateKey, toDateKey } from "@/lib/calendar-dates";

export type ReservationSheetStatus = "complete" | "partial" | "unassigned";

export type ReservationSheetRow = {
  id: string;
  kind: "email" | "ical_only";
  status: ReservationSheetStatus;
  listingId: string | null;
  listingTitle: string;
  guestName: string | null;
  guestCount: number | null;
  startDate: string;
  endDate: string;
  payoutCents: number | null;
  payoutCurrency: string | null;
  sourceUid: string | null;
  yearNeedsReview: boolean;
  yearReviewNote: string | null;
  icalMatched: boolean;
  icalStartDate: string | null;
  icalEndDate: string | null;
  missing: string[];
  note: string | null;
};

type IcalBlock = {
  listingId: string;
  listingTitle: string;
  start: Date;
  end: Date;
  uid?: string;
};

function datesClose(a: Date, b: Date, dayTolerance = 1) {
  const ms =
    Math.abs(
      parseDateKey(toDateKey(a)).getTime() - parseDateKey(toDateKey(b)).getTime()
    );
  return ms <= dayTolerance * 24 * 60 * 60 * 1000;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return toDateKey(aStart) < toDateKey(bEnd) && toDateKey(bStart) < toDateKey(aEnd);
}

function findIcalMatch(
  blocks: IcalBlock[],
  listingId: string,
  start: Date,
  end: Date,
  sourceUid: string | null
): IcalBlock | null {
  if (sourceUid) {
    const byUid = blocks.find(
      (block) => block.listingId === listingId && block.uid === sourceUid
    );
    if (byUid) return byUid;
  }

  const listingBlocks = blocks.filter((block) => block.listingId === listingId);
  const exact = listingBlocks.find(
    (block) =>
      toDateKey(block.start) === toDateKey(start) &&
      toDateKey(block.end) === toDateKey(end)
  );
  if (exact) return exact;

  const soft = listingBlocks
    .filter(
      (block) =>
        datesClose(block.start, start, 2) ||
        rangesOverlap(start, end, block.start, block.end)
    )
    .sort((a, b) => {
      const aStart = Math.abs(a.start.getTime() - start.getTime());
      const bStart = Math.abs(b.start.getTime() - start.getTime());
      if (aStart !== bStart) return aStart - bStart;
      return (
        Math.abs(a.end.getTime() - end.getTime()) -
        Math.abs(b.end.getTime() - end.getTime())
      );
    });
  return soft[0] || null;
}

function classifyEmailRow(args: {
  guestName: string | null;
  guestCount: number | null;
  payoutCents: number | null;
  yearNeedsReview: boolean;
  icalMatched: boolean;
}): { status: ReservationSheetStatus; missing: string[] } {
  const missing: string[] = [];
  if (!args.guestName?.trim()) missing.push("guest name");
  if (args.guestCount == null) missing.push("guest count");
  if (args.payoutCents == null) missing.push("payout");
  if (args.yearNeedsReview) missing.push("year review");
  if (!args.icalMatched) {
    return { status: "unassigned", missing: [...missing, "iCal stay"] };
  }
  if (missing.length === 0) return { status: "complete", missing };
  return { status: "partial", missing };
}

/** Build a color-coded sheet of email-synced stays (+ unmatched iCal bars). */
export async function buildGmailReservationSheet(
  hotelId: string
): Promise<{
  rows: ReservationSheetRow[];
  counts: { complete: number; partial: number; unassigned: number };
}> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    include: {
      listings: {
        orderBy: { createdAt: "asc" },
        include: {
          calendarSources: true,
          guestMetas: { orderBy: { startDate: "desc" } },
        },
      },
    },
  });

  if (!hotel) {
    return {
      rows: [],
      counts: { complete: 0, partial: 0, unassigned: 0 },
    };
  }

  const blocks: IcalBlock[] = [];
  for (const listing of hotel.listings) {
    const urls = [
      ...(listing.icalUrl ? [listing.icalUrl] : []),
      ...listing.calendarSources.map((source) => source.icalUrl),
    ];
    for (const icalUrl of urls) {
      try {
        const fetched = await fetchIcalBlocks(icalUrl);
        for (const block of fetched) {
          blocks.push({
            listingId: listing.id,
            listingTitle: listing.title,
            start: block.start,
            end: block.end,
            uid: block.uid,
          });
        }
      } catch {
        // Keep sheet usable if one feed fails
      }
    }
  }

  const rows: ReservationSheetRow[] = [];
  const matchedBlockKeys = new Set<string>();

  for (const listing of hotel.listings) {
    for (const meta of listing.guestMetas) {
      const match = findIcalMatch(
        blocks,
        listing.id,
        meta.startDate,
        meta.endDate,
        meta.sourceUid
      );
      if (match) {
        matchedBlockKeys.add(
          `${match.listingId}|${toDateKey(match.start)}|${toDateKey(match.end)}|${match.uid || ""}`
        );
      }
      const { status, missing } = classifyEmailRow({
        guestName: meta.guestName,
        guestCount: meta.guestCount,
        payoutCents: meta.payoutCents,
        yearNeedsReview: meta.yearNeedsReview,
        icalMatched: Boolean(match),
      });
      rows.push({
        id: meta.id,
        kind: "email",
        status,
        listingId: listing.id,
        listingTitle: listing.title,
        guestName: meta.guestName,
        guestCount: meta.guestCount,
        startDate: toDateKey(meta.startDate),
        endDate: toDateKey(meta.endDate),
        payoutCents: meta.payoutCents,
        payoutCurrency: meta.payoutCurrency,
        sourceUid: meta.sourceUid,
        yearNeedsReview: meta.yearNeedsReview,
        yearReviewNote: meta.yearReviewNote,
        icalMatched: Boolean(match),
        icalStartDate: match ? toDateKey(match.start) : null,
        icalEndDate: match ? toDateKey(match.end) : null,
        missing,
        note: meta.yearReviewNote,
      });
    }
  }

  // iCal bars with no email meta — still show as unassigned so hosts see gaps.
  const windowStart = new Date();
  windowStart.setMonth(windowStart.getMonth() - 1);
  const windowEnd = new Date();
  windowEnd.setMonth(windowEnd.getMonth() + 4);

  for (const block of blocks) {
    if (block.end < windowStart || block.start > windowEnd) continue;
    const key = `${block.listingId}|${toDateKey(block.start)}|${toDateKey(block.end)}|${block.uid || ""}`;
    if (matchedBlockKeys.has(key)) continue;

    // Soft-check against email rows already classified on this listing
    const alreadyCovered = rows.some(
      (row) =>
        row.kind === "email" &&
        row.listingId === block.listingId &&
        row.icalMatched &&
        row.icalStartDate === toDateKey(block.start) &&
        row.icalEndDate === toDateKey(block.end)
    );
    if (alreadyCovered) continue;

    rows.push({
      id: `ical:${block.listingId}:${toDateKey(block.start)}:${toDateKey(block.end)}`,
      kind: "ical_only",
      status: "unassigned",
      listingId: block.listingId,
      listingTitle: block.listingTitle,
      guestName: null,
      guestCount: null,
      startDate: toDateKey(block.start),
      endDate: toDateKey(block.end),
      payoutCents: null,
      payoutCurrency: null,
      sourceUid: block.uid || null,
      yearNeedsReview: false,
      yearReviewNote: null,
      icalMatched: true,
      icalStartDate: toDateKey(block.start),
      icalEndDate: toDateKey(block.end),
      missing: ["guest name", "guest count", "payout", "email match"],
      note: "On calendar (iCal) but no matching booking email yet",
    });
  }

  rows.sort((a, b) => {
    const statusRank = { unassigned: 0, partial: 1, complete: 2 } as const;
    if (statusRank[a.status] !== statusRank[b.status]) {
      return statusRank[a.status] - statusRank[b.status];
    }
    return a.startDate.localeCompare(b.startDate);
  });

  const counts = {
    complete: rows.filter((row) => row.status === "complete").length,
    partial: rows.filter((row) => row.status === "partial").length,
    unassigned: rows.filter((row) => row.status === "unassigned").length,
  };

  return { rows, counts };
}
