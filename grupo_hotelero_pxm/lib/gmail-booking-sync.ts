import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-crypto";
import {
  parseAirbnbBookingEmail,
  scoreListingNameInText,
} from "@/lib/parse-airbnb-email";
import { resolveListingAirbnbId } from "@/lib/airbnb-listing-id";
import { fetchIcalBlocks } from "@/lib/airbnb";
import { parseDateKey, toDateKey } from "@/lib/calendar-dates";

export type GmailSyncResult = {
  hotelId: string;
  scanned: number;
  matched: number;
  updated: number;
  skipped: number;
  timedOut?: boolean;
  batchOffset?: number;
  batchSize?: number;
  inboxMatches?: number;
  nextOffset?: number;
  errors: string[];
  samples: Array<{
    subject: string;
    guestName: string | null;
    guestCount: number | null;
    checkIn: string | null;
    checkOut: string | null;
    listingTitle?: string;
    payoutCents?: number | null;
    reason?: string;
  }>;
};

type ListingWithSources = {
  id: string;
  title: string;
  airbnbUrl: string;
  icalUrl: string | null;
  calendarSources: { icalUrl: string; name: string }[];
};

type ExternalBlock = {
  listingId: string;
  start: Date;
  end: Date;
  uid?: string;
};

function normalizeAppPassword(value: string) {
  return value.replace(/\s+/g, "");
}

function datesClose(a: Date, b: Date, dayTolerance = 1) {
  const aKey = toDateKey(a);
  const bKey = toDateKey(b);
  const ms =
    Math.abs(parseDateKey(aKey).getTime() - parseDateKey(bKey).getTime());
  return ms <= dayTolerance * 24 * 60 * 60 * 1000;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return toDateKey(aStart) < toDateKey(bEnd) && toDateKey(bStart) < toDateKey(aEnd);
}

function normalizeStayDate(date: Date) {
  return parseDateKey(toDateKey(date));
}

async function loadBlocksForListing(
  listing: ListingWithSources
): Promise<ExternalBlock[]> {
  const blocks: ExternalBlock[] = [];
  const sources = [
    ...(listing.icalUrl ? [{ icalUrl: listing.icalUrl }] : []),
    ...listing.calendarSources.map((source) => ({ icalUrl: source.icalUrl })),
  ];
  for (const source of sources) {
    try {
      const fetched = await fetchIcalBlocks(source.icalUrl);
      for (const block of fetched) {
        blocks.push({
          listingId: listing.id,
          start: block.start,
          end: block.end,
          uid: block.uid,
        });
      }
    } catch {
      // Keep going if one calendar fails
    }
  }
  return blocks;
}

function findListingByName(args: {
  listings: ListingWithSources[];
  emailText: string;
  airbnbListingId: string | null;
  listingHint: string | null;
}): { listingId: string | null; score: number; reason: string } {
  const { listings, emailText, airbnbListingId, listingHint } = args;

  let bestId: string | null = null;
  let bestScore = 0;
  let reason = "no listing match";

  for (const room of listings) {
    let score = 0;
    const airbnbId = resolveListingAirbnbId(room);
    if (airbnbListingId && airbnbId === airbnbListingId) {
      score += 1000;
    }

    const nameScore = scoreListingNameInText(
      room.title,
      emailText,
      room.calendarSources.map((source) => source.name)
    );
    score += nameScore;

    if (listingHint) {
      score += scoreListingNameInText(room.title, listingHint);
      for (const source of room.calendarSources) {
        score += scoreListingNameInText(source.name, listingHint);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = room.id;
      reason =
        airbnbListingId && airbnbId === airbnbListingId
          ? "airbnb listing id"
          : "listing name in email";
    }
  }

  if (bestScore >= 25 && bestId) {
    return { listingId: bestId, score: bestScore, reason };
  }

  if (listings.length === 1) {
    return { listingId: listings[0].id, score: 20, reason: "single-room hotel" };
  }

  return { listingId: null, score: bestScore, reason };
}

function findListingByIcalOverlap(args: {
  checkIn: Date;
  checkOut: Date | null;
  externalBlocks: ExternalBlock[];
  preferredListingId: string | null;
}): { listingId: string | null; reason: string } {
  const end =
    args.checkOut || new Date(args.checkIn.getTime() + 24 * 60 * 60 * 1000);
  const overlappingListingIds = [
    ...new Set(
      args.externalBlocks
        .filter((block) =>
          rangesOverlap(args.checkIn, end, block.start, block.end)
        )
        .map((block) => block.listingId)
    ),
  ];

  if (overlappingListingIds.length === 1) {
    return {
      listingId: overlappingListingIds[0],
      reason: "unique iCal date overlap",
    };
  }
  if (
    overlappingListingIds.length > 1 &&
    args.preferredListingId &&
    overlappingListingIds.includes(args.preferredListingId)
  ) {
    return {
      listingId: args.preferredListingId,
      reason: "listing name + iCal overlap",
    };
  }
  return { listingId: null, reason: "no unique iCal date overlap" };
}

function alignToIcalBlock(args: {
  listingId: string;
  startDate: Date;
  endDate: Date | null;
  externalBlocks: ExternalBlock[];
}): { startDate: Date; endDate: Date; sourceUid: string | null } {
  const { listingId, startDate, externalBlocks } = args;
  const endDate =
    args.endDate || new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

  const candidates = externalBlocks.filter(
    (block) =>
      block.listingId === listingId &&
      (datesClose(block.start, startDate, 2) ||
        rangesOverlap(startDate, endDate, block.start, block.end))
  );
  candidates.sort(
    (a, b) =>
      Math.abs(a.start.getTime() - startDate.getTime()) -
      Math.abs(b.start.getTime() - startDate.getTime())
  );
  const best = candidates[0];
  if (best) {
    return {
      startDate: normalizeStayDate(best.start),
      endDate: normalizeStayDate(best.end),
      sourceUid: best.uid || null,
    };
  }
  return {
    startDate: normalizeStayDate(startDate),
    endDate: normalizeStayDate(endDate),
    sourceUid: null,
  };
}

function summarizeSkipReasons(
  samples: GmailSyncResult["samples"]
): string | null {
  if (!samples.length) return "No reservation emails matched rooms/dates.";
  const counts = new Map<string, number>();
  for (const sample of samples) {
    const key = sample.reason || "skipped";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => `${count}× ${reason}`)
    .slice(0, 4)
    .join("; ");
}

export async function testHotelGmailConnection(hotelId: string) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel?.gmailSyncEmail || !hotel.gmailSyncPasswordEnc) {
    throw new Error("Connect a Gmail address and App Password first.");
  }
  const password = decryptSecret(hotel.gmailSyncPasswordEnc);
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: hotel.gmailSyncEmail,
      pass: normalizeAppPassword(password),
    },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      return {
        ok: true as const,
        email: hotel.gmailSyncEmail,
        messages:
          client.mailbox && "exists" in client.mailbox ? client.mailbox.exists : 0,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function syncHotelGmailBookings(
  hotelId: string,
  options: { lookbackDays?: number; limit?: number; timeBudgetMs?: number } = {}
): Promise<GmailSyncResult> {
  // Always process the newest N Airbnb emails (default 100).
  const lookbackDays = options.lookbackDays ?? 365;
  const limit = options.limit ?? 100;
  const timeBudgetMs = options.timeBudgetMs ?? 55_000;
  const startedAt = Date.now();
  const timeLeft = () => timeBudgetMs - (Date.now() - startedAt);

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    include: {
      listings: {
        include: { calendarSources: true },
      },
    },
  });

  if (!hotel?.gmailSyncEmail || !hotel.gmailSyncPasswordEnc) {
    throw new Error("Connect a Gmail address and App Password first.");
  }

  const listings = hotel.listings;
  const password = decryptSecret(hotel.gmailSyncPasswordEnc);
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: hotel.gmailSyncEmail,
      pass: normalizeAppPassword(password),
    },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });

  const result: GmailSyncResult = {
    hotelId,
    scanned: 0,
    matched: 0,
    updated: 0,
    skipped: 0,
    batchSize: limit,
    errors: [],
    samples: [],
  };

  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const blockCache = new Map<string, ExternalBlock[]>();

  async function blocksFor(listingId: string): Promise<ExternalBlock[]> {
    if (blockCache.has(listingId)) return blockCache.get(listingId)!;
    const listing = listingById.get(listingId);
    if (!listing) return [];
    const blocks = await loadBlocksForListing(listing);
    blockCache.set(listingId, blocks);
    return blocks;
  }

  async function allBlocks(): Promise<ExternalBlock[]> {
    const collected: ExternalBlock[] = [];
    for (const listing of listings) {
      if (timeLeft() < 8_000) break;
      collected.push(...(await blocksFor(listing.id)));
    }
    return collected;
  }

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      if (timeLeft() < 5_000) {
        result.timedOut = true;
        result.errors.push("Timed out before reading inbox");
      } else {
        // Search the inbox for Airbnb mail, then take the newest `limit` messages.
        const searchedA = await client.search({ since, from: "airbnb.com" });
        const searchedB = await client.search({ since, from: "airbnb.mx" });
        const uidSet = new Set<number>(
          [
            ...(Array.isArray(searchedA) ? searchedA : []),
            ...(Array.isArray(searchedB) ? searchedB : []),
          ]
            .map(Number)
            .filter((n) => Number.isFinite(n))
        );
        const allUids = [...uidSet].sort((a, b) => b - a);
        result.inboxMatches = allUids.length;
        const uids = allUids.slice(0, limit);

        let sharedBlocks: ExternalBlock[] | null = null;

        for (const uid of uids) {
          if (timeLeft() < 6_000) {
            result.timedOut = true;
            break;
          }

          try {
            const msg = await client.fetchOne(
              uid,
              { source: true, envelope: true },
              { uid: true }
            );
            if (!msg || !msg.source) {
              result.skipped += 1;
              continue;
            }

            const parsedMail = await simpleParser(msg.source);
            const subject = parsedMail.subject || msg.envelope?.subject || "";
            const html =
              typeof parsedMail.html === "string" ? parsedMail.html : "";
            const textBody = parsedMail.text || "";
            const parsed = parseAirbnbBookingEmail({
              subject,
              text: textBody,
              html,
            });
            result.scanned += 1;

            if (!parsed) {
              result.skipped += 1;
              if (result.samples.length < 12) {
                result.samples.push({
                  subject,
                  guestName: null,
                  guestCount: null,
                  checkIn: null,
                  checkOut: null,
                  reason: "not a reservation email / could not parse",
                });
              }
              continue;
            }

            const emailText = `${subject}\n${textBody}\n${html}`;
            const checkIn = parsed.checkIn ? parseDateKey(parsed.checkIn) : null;
            const checkOut = parsed.checkOut
              ? parseDateKey(parsed.checkOut)
              : null;

            let match = findListingByName({
              listings,
              emailText,
              airbnbListingId: parsed.airbnbListingId,
              listingHint: parsed.listingHint,
            });

            if (!match.listingId && checkIn && timeLeft() > 10_000) {
              if (!sharedBlocks) sharedBlocks = await allBlocks();
              const byDate = findListingByIcalOverlap({
                checkIn,
                checkOut,
                externalBlocks: sharedBlocks,
                preferredListingId: null,
              });
              if (byDate.listingId) {
                match = {
                  listingId: byDate.listingId,
                  score: 30,
                  reason: byDate.reason,
                };
              }
            }

            if (!match.listingId || !checkIn) {
              result.skipped += 1;
              if (result.samples.length < 12) {
                result.samples.push({
                  subject,
                  guestName: parsed.guestName,
                  guestCount: parsed.guestCount,
                  checkIn: parsed.checkIn,
                  checkOut: parsed.checkOut,
                  payoutCents: parsed.payoutCents,
                  reason: !checkIn
                    ? "missing check-in date"
                    : `listing not matched (${match.reason})`,
                });
              }
              continue;
            }

            const listingBlocks =
              timeLeft() > 4_000 ? await blocksFor(match.listingId) : [];
            const aligned = alignToIcalBlock({
              listingId: match.listingId,
              startDate: checkIn,
              endDate: checkOut,
              externalBlocks: listingBlocks,
            });

            result.matched += 1;

            const existing = await prisma.calendarGuestMeta.findMany({
              where: { listingId: match.listingId },
            });
            const overlap = existing.find(
              (meta) =>
                datesClose(meta.startDate, aligned.startDate, 2) ||
                rangesOverlap(
                  meta.startDate,
                  meta.endDate,
                  aligned.startDate,
                  aligned.endDate
                )
            );

            const guestName = parsed.guestName;
            const guestCount = parsed.guestCount;
            const payoutCents = parsed.payoutCents;
            const payoutCurrency = parsed.payoutCurrency;
            const sourceUid =
              aligned.sourceUid ||
              overlap?.sourceUid ||
              parsed.confirmationCode ||
              null;

            if (overlap) {
              await prisma.calendarGuestMeta.update({
                where: { id: overlap.id },
                data: {
                  guestName: guestName || overlap.guestName,
                  guestCount: guestCount ?? overlap.guestCount,
                  payoutCents: payoutCents ?? overlap.payoutCents,
                  payoutCurrency: payoutCurrency || overlap.payoutCurrency,
                  startDate: aligned.startDate,
                  endDate: aligned.endDate,
                  sourceUid,
                },
              });
            } else {
              await prisma.calendarGuestMeta.upsert({
                where: {
                  listingId_startDate_endDate: {
                    listingId: match.listingId,
                    startDate: aligned.startDate,
                    endDate: aligned.endDate,
                  },
                },
                update: {
                  guestName: guestName || undefined,
                  guestCount: guestCount ?? undefined,
                  payoutCents: payoutCents ?? undefined,
                  payoutCurrency: payoutCurrency || undefined,
                  sourceUid: sourceUid || undefined,
                },
                create: {
                  listingId: match.listingId,
                  startDate: aligned.startDate,
                  endDate: aligned.endDate,
                  guestName,
                  guestCount,
                  payoutCents,
                  payoutCurrency,
                  sourceUid,
                },
              });
            }

            const booking = await prisma.booking.findFirst({
              where: {
                listingId: match.listingId,
                status: { in: ["PENDING", "CONFIRMED"] },
                startDate: {
                  gte: new Date(aligned.startDate.getTime() - 24 * 60 * 60 * 1000),
                  lte: new Date(aligned.startDate.getTime() + 24 * 60 * 60 * 1000),
                },
              },
            });
            if (
              booking &&
              (guestName || guestCount != null || payoutCents != null)
            ) {
              await prisma.booking.update({
                where: { id: booking.id },
                data: {
                  ...(guestName ? { guestName } : {}),
                  ...(guestCount != null ? { guestCount } : {}),
                  ...(payoutCents != null
                    ? {
                        totalPriceCents: payoutCents,
                        ...(payoutCurrency ? { currency: payoutCurrency } : {}),
                      }
                    : {}),
                },
              });
            }

            result.updated += 1;
            if (result.samples.length < 12) {
              result.samples.push({
                subject,
                guestName,
                guestCount,
                checkIn: toDateKey(aligned.startDate),
                checkOut: toDateKey(aligned.endDate),
                listingTitle: listings.find((l) => l.id === match.listingId)?.title,
                payoutCents,
                reason: match.reason,
              });
            }
          } catch (error: any) {
            result.errors.push(error?.message || "Failed to parse one email");
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  await prisma.hotel.update({
    where: { id: hotelId },
    data: {
      gmailSyncLastAt: new Date(),
      gmailSyncLastError: result.errors.length
        ? result.errors.slice(0, 3).join("; ")
        : result.timedOut
          ? `Partial sync (time limit). Updated ${result.updated}. ${summarizeSkipReasons(result.samples) || ""}`.trim()
          : result.updated === 0
            ? summarizeSkipReasons(result.samples)
            : null,
    },
  });

  return result;
}

export async function syncAllConnectedGmailHotels() {
  const hotels = await prisma.hotel.findMany({
    where: {
      gmailSyncEnabled: true,
      gmailSyncEmail: { not: null },
      gmailSyncPasswordEnc: { not: null },
    },
    select: { id: true, name: true },
  });

  const results = [];
  for (const hotel of hotels) {
    try {
      results.push({
        hotelName: hotel.name,
        ...(await syncHotelGmailBookings(hotel.id)),
      });
    } catch (error: any) {
      await prisma.hotel.update({
        where: { id: hotel.id },
        data: {
          gmailSyncLastAt: new Date(),
          gmailSyncLastError: error?.message || "Gmail sync failed",
        },
      });
      results.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        error: error?.message || "Gmail sync failed",
      });
    }
  }
  return results;
}
