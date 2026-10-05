import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { HotelCalendarShare } from "@prisma/client";
import { DEFAULT_CALENDAR_PIN } from "./calendar-share-defaults";
import { prisma } from "./prisma";

export { DEFAULT_CALENDAR_PIN };

export const CALENDAR_PIN_PATTERN = /^\d{4,8}$/;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;
export const CALENDAR_ACCESS_MAX_AGE = 60 * 60 * 24 * 365;

export function slugifyCalendarName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function uniqueCalendarSlug(base: string, shareId?: string) {
  const root = base || "hotel";
  for (let n = 1; ; n += 1) {
    const candidate = n === 1 ? root : `${root}${n}`;
    const taken = await prisma.hotelCalendarShare.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken || taken.id === shareId) return candidate;
  }
}

async function ensureShareFields(share: HotelCalendarShare) {
  if (share.slug && share.pinHash) return share;
  const hotel = await prisma.hotel.findUnique({
    where: { id: share.hotelId },
    select: { name: true },
  });
  return prisma.hotelCalendarShare.update({
    where: { id: share.id },
    data: {
      slug: share.slug ?? (await uniqueCalendarSlug(slugifyCalendarName(hotel?.name ?? ""), share.id)),
      pinHash: share.pinHash ?? (await bcrypt.hash(DEFAULT_CALENDAR_PIN, 10)),
    },
  });
}

export async function getHotelCalendarShare(hotelId: string) {
  const share = await prisma.hotelCalendarShare.findUnique({ where: { hotelId } });
  return share ? ensureShareFields(share) : null;
}

export async function getOrCreateHotelCalendarShare(hotelId: string) {
  const existing = await getHotelCalendarShare(hotelId);
  if (existing) return existing;
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { name: true },
  });
  return prisma.hotelCalendarShare.create({
    data: {
      hotelId,
      token: randomBytes(24).toString("hex"),
      slug: await uniqueCalendarSlug(slugifyCalendarName(hotel?.name ?? "")),
      pinHash: await bcrypt.hash(DEFAULT_CALENDAR_PIN, 10),
    },
  });
}

export async function getHotelCalendarShareBySlug(slug: string) {
  const share = await prisma.hotelCalendarShare.findUnique({
    where: { slug: slug.toLowerCase() },
  });
  return share?.pinHash ? share : null;
}

export async function getHotelCalendarShareByToken(token: string) {
  const share = await prisma.hotelCalendarShare.findUnique({ where: { token } });
  return share ? ensureShareFields(share) : null;
}

export function getHotelCalendarShareUrl(slug: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}/${slug}/admincalendar`;
}

export function calendarAccessCookieName(share: Pick<HotelCalendarShare, "id">) {
  return `cal_${share.id}`;
}

export function calendarAccessCookieValue(
  share: Pick<HotelCalendarShare, "id" | "token" | "pinHash">
) {
  return createHmac("sha256", share.token)
    .update(`${share.id}:${share.pinHash ?? ""}`)
    .digest("hex");
}

export function hasCalendarAccess(
  share: Pick<HotelCalendarShare, "id" | "token" | "pinHash">,
  cookieValue: string | undefined
) {
  if (!cookieValue || !share.pinHash) return false;
  const expected = Buffer.from(calendarAccessCookieValue(share));
  const received = Buffer.from(cookieValue);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function calendarAccessCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      !(
        process.env.AUTH_INSECURE_COOKIE === "1" &&
        process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://127.0.0.1")
      ),
    sameSite: "lax" as const,
    path: "/",
    maxAge: CALENDAR_ACCESS_MAX_AGE,
  };
}

export type PinCheckResult =
  | { ok: true; share: HotelCalendarShare }
  | { ok: false; reason: "invalid" | "locked"; retryAfterSeconds?: number };

export async function verifyCalendarPin(
  share: HotelCalendarShare,
  pin: string
): Promise<PinCheckResult> {
  const now = Date.now();
  if (share.pinLockedUntil && share.pinLockedUntil.getTime() > now) {
    return {
      ok: false,
      reason: "locked",
      retryAfterSeconds: Math.ceil((share.pinLockedUntil.getTime() - now) / 1000),
    };
  }
  const valid =
    Boolean(share.pinHash) &&
    CALENDAR_PIN_PATTERN.test(pin) &&
    (await bcrypt.compare(pin, share.pinHash as string));

  if (valid) {
    const updated = await prisma.hotelCalendarShare.update({
      where: { id: share.id },
      data: { failedPinAttempts: 0, pinLockedUntil: null },
    });
    return { ok: true, share: updated };
  }

  const attempts = share.failedPinAttempts + 1;
  const lock = attempts >= MAX_PIN_ATTEMPTS;
  await prisma.hotelCalendarShare.update({
    where: { id: share.id },
    data: {
      failedPinAttempts: lock ? 0 : attempts,
      pinLockedUntil: lock ? new Date(now + PIN_LOCK_MS) : share.pinLockedUntil,
    },
  });
  return lock
    ? { ok: false, reason: "locked", retryAfterSeconds: PIN_LOCK_MS / 1000 }
    : { ok: false, reason: "invalid" };
}

export async function setHotelCalendarPin(hotelId: string, pin: string) {
  if (!CALENDAR_PIN_PATTERN.test(pin)) {
    throw new Error("PIN must be 4 to 8 digits");
  }
  const share = await getOrCreateHotelCalendarShare(hotelId);
  return prisma.hotelCalendarShare.update({
    where: { id: share.id },
    data: {
      pinHash: await bcrypt.hash(pin, 10),
      failedPinAttempts: 0,
      pinLockedUntil: null,
    },
  });
}
