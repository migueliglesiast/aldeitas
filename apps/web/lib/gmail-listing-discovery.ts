import { ImapFlow } from "imapflow";
import { resolveListingAirbnbId } from "@/lib/airbnb-listing-id";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-crypto";

const LOOKBACK_DAYS = 540;
const MAX_EMAILS = 200;
const MAX_LISTINGS = 20;

export type GmailListing = {
  airbnbId: string;
  bookings: number;
  /** Room in this hotel already linked to this Airbnb listing. */
  roomId: string | null;
};

/** Airbnb listing IDs linked from a raw (possibly quoted-printable) email source. */
export function extractAirbnbRoomIds(source: string): string[] {
  const decoded = source.replace(/=\r?\n/g, "").replace(/=3D/gi, "=");
  const ids = new Set<string>();
  for (const match of decoded.matchAll(/airbnb\.[a-z.]+\/rooms\/(\d{5,})/gi)) ids.add(match[1]);
  return [...ids];
}

async function countRoomIdsInGmail(email: string, appPassword: string) {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: appPassword.replace(/\s+/g, "") },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
  });
  const counts = new Map<string, number>();
  await client.connect();
  try {
    const lock = await client
      .getMailboxLock("[Gmail]/All Mail")
      .catch(() => client.getMailboxLock("INBOX"));
    try {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
      const uids = new Set<number>();
      for (const subject of ["Reservation confirmed", "Reserva confirmada"]) {
        const found = await client.search({ since, from: "airbnb", subject }, { uid: true });
        for (const uid of found || []) uids.add(uid);
      }
      const latest = [...uids].sort((a, b) => a - b).slice(-MAX_EMAILS);
      if (latest.length === 0) return counts;
      for await (const message of client.fetch(latest.join(","), { source: true }, { uid: true })) {
        if (!message.source) continue;
        for (const id of extractAirbnbRoomIds(message.source.toString("utf8"))) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  return counts;
}

/** Airbnb listings that appear in the hotel's booking emails, most-booked first. */
export async function scanHotelGmailListings(hotelId: string): Promise<GmailListing[]> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      gmailSyncEmail: true,
      gmailSyncPasswordEnc: true,
      listings: {
        select: { id: true, airbnbId: true, airbnbUrl: true, icalUrl: true, calendarSources: { select: { icalUrl: true } } },
      },
    },
  });
  if (!hotel?.gmailSyncEmail || !hotel.gmailSyncPasswordEnc) {
    throw new Error("Connect Gmail first.");
  }

  const counts = await countRoomIdsInGmail(hotel.gmailSyncEmail, decryptSecret(hotel.gmailSyncPasswordEnc));
  const linked = new Map<string, string>();
  for (const listing of hotel.listings) {
    const airbnbId = resolveListingAirbnbId(listing);
    if (airbnbId) linked.set(airbnbId, listing.id);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LISTINGS)
    .map(([airbnbId, bookings]) => ({ airbnbId, bookings, roomId: linked.get(airbnbId) ?? null }));
}
