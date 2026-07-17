import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-crypto";
import { parseAirbnbBookingEmail } from "@/lib/parse-airbnb-email";
import { resolveListingAirbnbId } from "@/lib/airbnb-listing-id";
import { parseDateKey, toDateKey } from "@/lib/calendar-dates";

export type GmailSyncResult = {
  hotelId: string;
  scanned: number;
  matched: number;
  updated: number;
  skipped: number;
  errors: string[];
  samples: Array<{
    subject: string;
    guestName: string | null;
    guestCount: number | null;
    checkIn: string | null;
    checkOut: string | null;
    listingTitle?: string;
  }>;
};

function normalizeAppPassword(value: string) {
  return value.replace(/\s+/g, "");
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
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      return {
        ok: true as const,
        email: hotel.gmailSyncEmail,
        messages: client.mailbox && "exists" in client.mailbox ? client.mailbox.exists : 0,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

function datesClose(a: Date, b: Date, dayTolerance = 1) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms <= dayTolerance * 24 * 60 * 60 * 1000;
}

export async function syncHotelGmailBookings(
  hotelId: string,
  options: { lookbackDays?: number; limit?: number } = {}
): Promise<GmailSyncResult> {
  const lookbackDays = options.lookbackDays ?? 45;
  const limit = options.limit ?? 40;

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
  });

  const result: GmailSyncResult = {
    hotelId,
    scanned: 0,
    matched: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    samples: [],
  };

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchedA = await client.search({ since, from: "airbnb.com" });
      const searchedB = await client.search({ since, from: "airbnb.mx" });
      const uidSet = new Set<number>([
        ...(Array.isArray(searchedA) ? searchedA : []),
        ...(Array.isArray(searchedB) ? searchedB : []),
      ].map(Number).filter((n) => Number.isFinite(n)));
      const uids = [...uidSet].sort((a, b) => b - a).slice(0, limit);

      for (const uid of uids) {
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
          const parsed = parseAirbnbBookingEmail({
            subject,
            text: parsedMail.text || "",
            html: typeof parsedMail.html === "string" ? parsedMail.html : "",
          });
          result.scanned += 1;

          if (!parsed) {
            result.skipped += 1;
            continue;
          }

          const listing = hotel.listings.find((room) => {
            const airbnbId = resolveListingAirbnbId(room);
            if (parsed.airbnbListingId && airbnbId === parsed.airbnbListingId) {
              return true;
            }
            if (parsed.listingHint) {
              const hint = parsed.listingHint.toLowerCase();
              if (
                room.title.toLowerCase().includes(hint) ||
                hint.includes(room.title.toLowerCase())
              ) {
                return true;
              }
            }
            return false;
          });

          let matchedListingId = listing?.id || null;
          let startDate: Date | null = parsed.checkIn
            ? parseDateKey(parsed.checkIn)
            : null;
          let endDate: Date | null = parsed.checkOut
            ? parseDateKey(parsed.checkOut)
            : null;

          // Single-room hotels: if dates exist but listing ID/title didn't match, use that room
          if ((!matchedListingId || !startDate) && parsed.checkIn) {
            const checkIn = parseDateKey(parsed.checkIn);
            if (hotel.listings.length === 1) {
              matchedListingId = hotel.listings[0].id;
              startDate = checkIn;
              if (!endDate) {
                endDate = new Date(checkIn);
                endDate.setDate(endDate.getDate() + 1);
              }
            }
          }

          if (!matchedListingId || !startDate) {
            result.skipped += 1;
            result.samples.push({
              subject,
              guestName: parsed.guestName,
              guestCount: parsed.guestCount,
              checkIn: parsed.checkIn,
              checkOut: parsed.checkOut,
            });
            continue;
          }

          if (!endDate) {
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
          }

          result.matched += 1;

          // Prefer updating an existing meta that overlaps these dates for this listing
          const existing = await prisma.calendarGuestMeta.findMany({
            where: { listingId: matchedListingId },
          });
          const overlap = existing.find(
            (meta) =>
              datesClose(meta.startDate, startDate!) ||
              (meta.startDate <= endDate! && startDate! < meta.endDate)
          );

          const guestName = parsed.guestName;
          const guestCount = parsed.guestCount;

          if (overlap) {
            await prisma.calendarGuestMeta.update({
              where: { id: overlap.id },
              data: {
                guestName: guestName || overlap.guestName,
                guestCount: guestCount ?? overlap.guestCount,
                startDate,
                endDate,
                sourceUid: parsed.confirmationCode || overlap.sourceUid,
              },
            });
          } else {
            await prisma.calendarGuestMeta.upsert({
              where: {
                listingId_startDate_endDate: {
                  listingId: matchedListingId,
                  startDate,
                  endDate,
                },
              },
              update: {
                guestName: guestName || undefined,
                guestCount: guestCount ?? undefined,
                sourceUid: parsed.confirmationCode || undefined,
              },
              create: {
                listingId: matchedListingId,
                startDate,
                endDate,
                guestName,
                guestCount,
                sourceUid: parsed.confirmationCode || null,
              },
            });
          }

          // Also update a direct booking if one matches these dates
          const booking = await prisma.booking.findFirst({
            where: {
              listingId: matchedListingId,
              status: { in: ["PENDING", "CONFIRMED"] },
              startDate: {
                gte: new Date(startDate.getTime() - 24 * 60 * 60 * 1000),
                lte: new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
              },
            },
          });
          if (booking && (guestName || guestCount)) {
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                ...(guestName ? { guestName } : {}),
                ...(guestCount != null ? { guestCount } : {}),
              },
            });
          }

          result.updated += 1;
          result.samples.push({
            subject,
            guestName,
            guestCount,
            checkIn: toDateKey(startDate),
            checkOut: toDateKey(endDate),
            listingTitle: hotel.listings.find((l) => l.id === matchedListingId)?.title,
          });
        } catch (error: any) {
          result.errors.push(error?.message || "Failed to parse one email");
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
      gmailSyncLastError: result.errors.length ? result.errors.slice(0, 3).join("; ") : null,
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
