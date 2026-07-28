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
  gapsFound?: number;
  gapsTargeted?: number;
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
  airbnbId?: string | null;
  calendarSources: { icalUrl: string; name: string }[];
};

type ExternalBlock = {
  listingId: string;
  start: Date;
  end: Date;
  uid?: string;
};

type CalendarGap = {
  listingId: string;
  listingTitle: string;
  airbnbListingId: string | null;
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  /** Normalized "aug 3" from check-in — matches Airbnb subject "arrives Aug 3". */
  arrivesKey: string;
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

/** Airbnb subjects use "arrives Aug 3" — normalize month+day for matching. */
function arrivesKeyFromDate(date: Date): string {
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const key = toDateKey(date);
  const month = Number(key.slice(5, 7)) - 1;
  const day = Number(key.slice(8, 10));
  return `${months[month]} ${day}`;
}

function arrivesKeyFromSubject(subject: string): string | null {
  const en = subject.match(
    /arrives\s+(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*\d{4})?/i
  );
  if (en) {
    const month = en[1].toLowerCase().slice(0, 3);
    const normalized =
      month === "sept" ? "sep" : month === "sep" ? "sep" : month.slice(0, 3);
    return `${normalized} ${Number(en[2])}`;
  }
  const es = subject.match(
    /llega(?:\s+el)?\s+(?:(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)[a-z.]*\s+)?(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ.]{3,12})/i
  );
  if (es) {
    const map: Record<string, string> = {
      ene: "jan",
      enero: "jan",
      feb: "feb",
      febrero: "feb",
      mar: "mar",
      marzo: "mar",
      abr: "apr",
      abril: "apr",
      may: "may",
      mayo: "may",
      jun: "jun",
      junio: "jun",
      jul: "jul",
      julio: "jul",
      ago: "aug",
      agosto: "aug",
      sep: "sep",
      sept: "sep",
      septiembre: "sep",
      oct: "oct",
      octubre: "oct",
      nov: "nov",
      noviembre: "nov",
      dic: "dec",
      diciembre: "dec",
    };
    const raw = es[2].toLowerCase().replace(/\./g, "");
    const month = map[raw] || map[raw.slice(0, 3)];
    if (month) return `${month} ${Number(es[1])}`;
  }
  return null;
}

function metaCoversBlock(
  meta: {
    listingId: string;
    startDate: Date;
    endDate: Date;
    guestName: string | null;
  },
  block: ExternalBlock
) {
  if (meta.listingId !== block.listingId) return false;
  if (!meta.guestName?.trim()) return false;
  return (
    datesClose(meta.startDate, block.start, 2) ||
    rangesOverlap(meta.startDate, meta.endDate, block.start, block.end)
  );
}

/** iCal stays in the visible window that still lack a guest name from email sync. */
async function collectCalendarGaps(args: {
  listings: ListingWithSources[];
  blocksFor: (listingId: string) => Promise<ExternalBlock[]>;
  timeLeft: () => number;
}): Promise<CalendarGap[]> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 14);
  const windowEnd = new Date();
  windowEnd.setMonth(windowEnd.getMonth() + 4);

  const metas = await prisma.calendarGuestMeta.findMany({
    where: { listingId: { in: args.listings.map((listing) => listing.id) } },
    select: {
      listingId: true,
      startDate: true,
      endDate: true,
      guestName: true,
    },
  });

  const gaps: CalendarGap[] = [];
  for (const listing of args.listings) {
    if (args.timeLeft() < 10_000) break;
    const blocks = await args.blocksFor(listing.id);
    const airbnbListingId = resolveListingAirbnbId(listing);
    for (const block of blocks) {
      if (block.end < windowStart || block.start > windowEnd) continue;
      const covered = metas.some((meta) => metaCoversBlock(meta, block));
      if (covered) continue;
      gaps.push({
        listingId: listing.id,
        listingTitle: listing.title,
        airbnbListingId,
        start: block.start,
        end: block.end,
        startKey: toDateKey(block.start),
        endKey: toDateKey(block.end),
        arrivesKey: arrivesKeyFromDate(block.start),
      });
    }
  }

  gaps.sort((a, b) => a.startKey.localeCompare(b.startKey));
  return gaps;
}

function subjectMatchesGaps(subject: string, gapArrivesKeys: Set<string>) {
  const key = arrivesKeyFromSubject(subject);
  if (!key) return false;
  return gapArrivesKeys.has(key);
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

  // Prefer listing ID from the email (/rooms/{id}) against each room's linked
  // iCal URL / airbnbId — that is the reliable room assignment when iCal is linked.
  if (airbnbListingId) {
    for (const room of listings) {
      const airbnbId = resolveListingAirbnbId(room);
      if (airbnbId && airbnbId === airbnbListingId) {
        return {
          listingId: room.id,
          score: 1000,
          reason: "airbnb listing id (from iCal link)",
        };
      }
    }
  }

  // Fall back to listing-name fuzzy match only when the email had no room ID
  // (or the ID is not linked on any room in this hotel).
  let bestId: string | null = null;
  let bestScore = 0;
  let reason = "no listing match";

  for (const room of listings) {
    let score = 0;

    const nameScore = scoreListingNameInText(
      room.title,
      emailText,
      room.calendarSources.map((source) => source.name)
    );
    score += nameScore;

    if (listingHint) {
      score += scoreListingNameInText(room.title, listingHint);
      // Reverse: distinctive words from the Airbnb listing title vs room title
      score += scoreListingNameInText(listingHint, room.title);
      for (const source of room.calendarSources) {
        score += scoreListingNameInText(source.name, listingHint);
        score += scoreListingNameInText(listingHint, source.name);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = room.id;
      reason = "listing name in email";
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

  // Prefer blocks with the same stay window (check-in + checkout), not just any overlap.
  // Many rooms are booked on the same nights — full-range overlap alone is too ambiguous.
  const stayMatches = args.externalBlocks.filter(
    (block) =>
      datesClose(block.start, args.checkIn, 1) &&
      datesClose(block.end, end, 1)
  );
  const stayListingIds = [...new Set(stayMatches.map((block) => block.listingId))];
  if (stayListingIds.length === 1) {
    return { listingId: stayListingIds[0], reason: "iCal stay dates match" };
  }
  if (
    stayListingIds.length > 1 &&
    args.preferredListingId &&
    stayListingIds.includes(args.preferredListingId)
  ) {
    return {
      listingId: args.preferredListingId,
      reason: "listing + iCal stay match",
    };
  }

  // Next: same check-in day only (checkout sometimes off by 1 in exports)
  const checkInMatches = args.externalBlocks.filter((block) =>
    datesClose(block.start, args.checkIn, 1)
  );
  const checkInListingIds = [
    ...new Set(checkInMatches.map((block) => block.listingId)),
  ];
  if (checkInListingIds.length === 1) {
    return {
      listingId: checkInListingIds[0],
      reason: "unique iCal check-in match",
    };
  }
  if (
    checkInListingIds.length > 1 &&
    args.preferredListingId &&
    checkInListingIds.includes(args.preferredListingId)
  ) {
    return {
      listingId: args.preferredListingId,
      reason: "listing + iCal check-in match",
    };
  }

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
  options: {
    lookbackDays?: number;
    limit?: number;
    timeBudgetMs?: number;
    restart?: boolean;
  } = {}
): Promise<GmailSyncResult> {
  // Hostinger kills long requests — keep searches lean and process newest matches.
  const lookbackDays = options.lookbackDays ?? 180;
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

  const listings = hotel.listings as ListingWithSources[];
  const password = decryptSecret(hotel.gmailSyncPasswordEnc);
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  const offset = Math.max(0, hotel.gmailSyncOffset || 0);

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
    batchOffset: offset,
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

  // Build the missing-guest list from iCal before touching Gmail.
  const gaps = await collectCalendarGaps({
    listings,
    blocksFor,
    timeLeft,
  });
  result.gapsFound = gaps.length;
  const gapArrivesKeys = new Set(gaps.map((gap) => gap.arrivesKey));
  const gapAirbnbIds = new Set(
    gaps.map((gap) => gap.airbnbListingId).filter(Boolean) as string[]
  );

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      if (timeLeft() < 5_000) {
        result.timedOut = true;
        result.errors.push("Timed out before reading inbox");
      } else {
        // IMPORTANT: On Gmail, subject searches return SEQUENCE numbers, not UIDs.
        // Fetch them WITHOUT `{ uid: true }`.
        const subjectQueries: Array<{
          since: Date;
          from: string;
          subject: string;
        }> = [
          { since, from: "airbnb.com", subject: "Reservation confirmed" },
          { since, from: "airbnb.mx", subject: "Reservation confirmed" },
          { since, from: "airbnb.com", subject: "Reserva confirmada" },
          { since, from: "airbnb.mx", subject: "Reserva confirmada" },
        ];
        // Also hunt directly for gap check-in dates in the subject line.
        const gapDateLabels = [...gapArrivesKeys].slice(0, 40);
        for (const label of gapDateLabels) {
          // "aug 3" → "Aug 3" for subject search
          const pretty = label.replace(/^\w/, (c) => c.toUpperCase());
          subjectQueries.push({
            since,
            from: "airbnb.com",
            subject: `arrives ${pretty}`,
          });
        }

        const seqSet = new Set<number>();
        for (const query of subjectQueries) {
          if (timeLeft() < 8_000) break;
          try {
            const searched = await client.search(query);
            for (const seq of Array.isArray(searched) ? searched : []) {
              const n = Number(seq);
              if (Number.isFinite(n)) seqSet.add(n);
            }
          } catch {
            // ignore one failed subject search
          }
        }

        const allSeqs = [...seqSet].sort((a, b) => b - a);
        result.inboxMatches = allSeqs.length;

        // Envelope pass: keep confirmation emails whose arrival date matches a gap.
        // Always keep a small newest slice too (brand-new bookings not yet on iCal).
        const gapSeqs: number[] = [];
        const newestSeqs: number[] = [];
        const envelopeScan = allSeqs.slice(0, Math.min(allSeqs.length, 280));
        if (envelopeScan.length && timeLeft() > 8_000) {
          for await (const msg of client.fetch(envelopeScan, {
            envelope: true,
          })) {
            if (timeLeft() < 6_000) break;
            const subject = msg.envelope?.subject || "";
            if (
              !/reservation confirmed|reserva confirmada|booking confirmed|new booking confirmed/i.test(
                subject
              )
            ) {
              continue;
            }
            const seq = Number(msg.seq);
            if (!Number.isFinite(seq)) continue;
            if (gapArrivesKeys.size === 0 || subjectMatchesGaps(subject, gapArrivesKeys)) {
              gapSeqs.push(seq);
            } else if (newestSeqs.length < 12) {
              newestSeqs.push(seq);
            }
            if (gapSeqs.length >= limit) break;
          }
        }

        // Prefer gap matches; fall back to newest confirmations if few gaps matched.
        const prioritized = [
          ...new Set([
            ...gapSeqs.sort((a, b) => b - a),
            ...newestSeqs,
            // If envelope scan found nothing (empty gaps / timeout), use newest seqs.
            ...(gapSeqs.length === 0 && newestSeqs.length === 0
              ? allSeqs.slice(0, limit)
              : []),
          ]),
        ];
        result.gapsTargeted = gapSeqs.length;

        const startAt =
          options.restart === true || !offset || gapSeqs.length > 0
            ? 0
            : Math.min(offset, Math.max(0, prioritized.length - 1));
        const uids = prioritized.slice(startAt, startAt + limit);
        result.batchOffset = startAt;
        const priorityUids = prioritized;
        const fetchByUid = false;

        let sharedBlocks: ExternalBlock[] | null = null;
        let processedInBatch = 0;

        // Refresh known complete metas so we can skip emails that won't help.
        const knownMetas = await prisma.calendarGuestMeta.findMany({
          where: { listingId: { in: listings.map((listing) => listing.id) } },
          select: {
            listingId: true,
            startDate: true,
            endDate: true,
            guestName: true,
          },
        });

        for (const uid of uids) {
          if (timeLeft() < 3_000) {
            result.timedOut = true;
            break;
          }

          try {
            // One fetch per message (envelope + body).
            // Subject-search hits are sequence numbers on Gmail — do not pass uid:true.
            const msg = await client.fetchOne(
              uid,
              { source: true, envelope: true },
              fetchByUid ? { uid: true } : undefined
            );
            processedInBatch += 1;
            if (!msg || !msg.source) {
              result.skipped += 1;
              continue;
            }

            const envelopeSubject = msg.envelope?.subject || "";
            if (
              /tip|inspiration|wishlist|weekly update|hosting tips|aircover|experience near|review reminder|left a \d-star review/i.test(
                envelopeSubject
              )
            ) {
              result.skipped += 1;
              continue;
            }

            // Only process confirmation / alteration reservation emails.
            const looksLikeReservation =
              /reservation confirmed|reserva confirmada|booking confirmed|new booking confirmed|nueva reserva|reservation altered|alteraci[oó]n de la reserva|pending reservation/i.test(
                envelopeSubject
              );
            if (!looksLikeReservation) {
              result.skipped += 1;
              continue;
            }

            // If we still have gaps, skip emails that clearly don't match any gap date
            // (unless this is one of the small newest fallback set).
            const hitsGap =
              gapArrivesKeys.size === 0 ||
              subjectMatchesGaps(envelopeSubject, gapArrivesKeys);
            if (gaps.length > 0 && !hitsGap && !newestSeqs.includes(uid)) {
              result.skipped += 1;
              continue;
            }

            const parsedMail = await simpleParser(msg.source);
            const subject = parsedMail.subject || envelopeSubject || "";
            const textBody = parsedMail.text || "";
            // Always keep HTML for /rooms/{id} links (often missing from plain text).
            const html =
              typeof parsedMail.html === "string" ? parsedMail.html : "";
            const parsed = parseAirbnbBookingEmail({
              subject,
              text: textBody,
              html,
              referenceDate: parsedMail.date || msg.envelope?.date || null,
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

            const emailText = `${subject}\n${textBody}`;
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

            // When the email room ID already matched a linked iCal, keep that room.
            // Otherwise use iCal stay dates to pick the room among open listings.
            const idMatched = match.score >= 1000 && match.listingId;
            if (checkIn && !idMatched && timeLeft() > 5_000) {
              if (!sharedBlocks) sharedBlocks = await allBlocks();
              const byDate = findListingByIcalOverlap({
                checkIn,
                checkOut,
                externalBlocks: sharedBlocks,
                preferredListingId: match.listingId,
              });
              if (byDate.listingId) {
                match = {
                  listingId: byDate.listingId,
                  score: Math.max(match.score, 40),
                  reason: match.listingId
                    ? `${match.reason} + ${byDate.reason}`
                    : byDate.reason,
                };
              }
            } else if (checkIn && idMatched && timeLeft() > 5_000) {
              // Still load blocks later for year confirmation / date alignment.
              if (!sharedBlocks) sharedBlocks = await allBlocks();
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
                    : `listing not matched (${match.reason}; hint=${parsed.listingHint || "none"}; roomId=${parsed.airbnbListingId || "none"})`,
                });
              }
              continue;
            }

            // Already have a named guest on this stay — skip (gap-fill mode).
            const alreadyNamed = knownMetas.find(
              (meta) =>
                meta.listingId === match.listingId &&
                meta.guestName?.trim() &&
                datesClose(meta.startDate, checkIn, 2)
            );
            if (alreadyNamed) {
              result.skipped += 1;
              continue;
            }

            // If filling gaps and this listing ID isn't among gap rooms, skip unless
            // the arrival date matches a gap (shared check-in days across rooms).
            if (
              gaps.length > 0 &&
              parsed.airbnbListingId &&
              gapAirbnbIds.size > 0 &&
              !gapAirbnbIds.has(parsed.airbnbListingId) &&
              !hitsGap
            ) {
              result.skipped += 1;
              continue;
            }

            const listingBlocks =
              timeLeft() > 4_000 ? await blocksFor(match.listingId) : [];
            const aligned = alignToIcalBlock({
              listingId: match.listingId,
              startDate: checkIn,
              endDate: checkOut,
              externalBlocks: listingBlocks.length
                ? listingBlocks
                : (sharedBlocks || []).filter(
                    (block) => block.listingId === match.listingId
                  ),
            });

            // Only adopt iCal dates when check-in/out line up. Otherwise keep the
            // email stay (avoids snapping onto another reservation in a wrong year).
            const icalConfirmsYear =
              Boolean(aligned.sourceUid) &&
              datesClose(aligned.startDate, checkIn, 1) &&
              (!checkOut || datesClose(aligned.endDate, checkOut, 1));

            const stay = icalConfirmsYear
              ? aligned
              : {
                  startDate: normalizeStayDate(checkIn),
                  endDate: normalizeStayDate(
                    checkOut ||
                      new Date(checkIn.getTime() + 24 * 60 * 60 * 1000)
                  ),
                  sourceUid: null as string | null,
                };

            let yearNeedsReview = parsed.yearNeedsReview;
            let yearReviewNote = parsed.yearReviewNote;
            if (icalConfirmsYear) {
              yearNeedsReview = false;
              yearReviewNote = null;
            } else if (parsed.yearInferred && aligned.sourceUid) {
              // There is an iCal bar nearby, but it does not match this stay window.
              yearNeedsReview = true;
              yearReviewNote = [
                yearReviewNote,
                "Nearby iCal bar does not match email stay dates — check the year",
              ]
                .filter(Boolean)
                .join("; ");
            } else if (parsed.yearNeedsReview) {
              // Keep parser flags (year boundary, stay before email, far future, etc.)
            }

            result.matched += 1;

            const existing = await prisma.calendarGuestMeta.findMany({
              where: { listingId: match.listingId },
            });
            const overlap = existing.find(
              (meta) =>
                datesClose(meta.startDate, stay.startDate, 2) ||
                rangesOverlap(
                  meta.startDate,
                  meta.endDate,
                  stay.startDate,
                  stay.endDate
                )
            );

            const guestName = parsed.guestName;
            const guestCount = parsed.guestCount;
            const payoutCents = parsed.payoutCents;
            const payoutCurrency = parsed.payoutCurrency;
            const sourceUid = stay.sourceUid || overlap?.sourceUid || null;

            if (overlap) {
              await prisma.calendarGuestMeta.update({
                where: { id: overlap.id },
                data: {
                  guestName: guestName || overlap.guestName,
                  guestCount: guestCount ?? overlap.guestCount,
                  payoutCents: payoutCents ?? overlap.payoutCents,
                  payoutCurrency: payoutCurrency || overlap.payoutCurrency,
                  startDate: stay.startDate,
                  endDate: stay.endDate,
                  sourceUid,
                  yearNeedsReview,
                  yearReviewNote,
                },
              });
            } else {
              await prisma.calendarGuestMeta.upsert({
                where: {
                  listingId_startDate_endDate: {
                    listingId: match.listingId,
                    startDate: stay.startDate,
                    endDate: stay.endDate,
                  },
                },
                update: {
                  guestName: guestName || undefined,
                  guestCount: guestCount ?? undefined,
                  payoutCents: payoutCents ?? undefined,
                  payoutCurrency: payoutCurrency || undefined,
                  sourceUid: sourceUid || undefined,
                  yearNeedsReview,
                  yearReviewNote,
                },
                create: {
                  listingId: match.listingId,
                  startDate: stay.startDate,
                  endDate: stay.endDate,
                  guestName,
                  guestCount,
                  payoutCents,
                  payoutCurrency,
                  sourceUid,
                  yearNeedsReview,
                  yearReviewNote,
                },
              });
            }

            const booking = await prisma.booking.findFirst({
              where: {
                listingId: match.listingId,
                status: { in: ["PENDING", "CONFIRMED"] },
                startDate: {
                  gte: new Date(stay.startDate.getTime() - 24 * 60 * 60 * 1000),
                  lte: new Date(stay.startDate.getTime() + 24 * 60 * 60 * 1000),
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
            if (guestName) {
              knownMetas.push({
                listingId: match.listingId!,
                startDate: stay.startDate,
                endDate: stay.endDate,
                guestName,
              });
            }
            if (result.samples.length < 12) {
              result.samples.push({
                subject,
                guestName,
                guestCount,
                checkIn: toDateKey(stay.startDate),
                checkOut: toDateKey(stay.endDate),
                listingTitle: listings.find((l) => l.id === match.listingId)?.title,
                payoutCents,
                reason: yearNeedsReview
                  ? `${match.reason} · year needs review`
                  : match.reason,
              });
            }
          } catch (error: any) {
            result.errors.push(error?.message || "Failed to parse one email");
          }
        }

        const advanced = Math.max(processedInBatch, 1);
        result.nextOffset =
          priorityUids.length === 0
            ? 0
            : (startAt + advanced) % priorityUids.length;
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
      gmailSyncOffset: result.nextOffset ?? offset,
      gmailSyncLastError: result.errors.length
        ? result.errors.slice(0, 3).join("; ")
        : result.updated > 0
          ? null
          : result.timedOut
            ? `Partial sync (time limit). ${summarizeSkipReasons(result.samples) || ""}`.trim()
            : summarizeSkipReasons(result.samples),
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
