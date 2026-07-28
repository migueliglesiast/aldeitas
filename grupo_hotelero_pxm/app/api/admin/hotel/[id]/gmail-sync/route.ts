import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { encryptSecret } from "@/lib/secret-crypto";
import {
  syncHotelGmailBookings,
  testHotelGmailConnection,
} from "@/lib/gmail-booking-sync";
import { parseDateKey, toDateKey } from "@/lib/calendar-dates";
import { buildGmailReservationSheet } from "@/lib/gmail-reservation-sheet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const saveSchema = z.object({
  email: z.string().email(),
  appPassword: z
    .string()
    .max(64)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() || "";
      return trimmed ? trimmed : undefined;
    })
    .refine((value) => value === undefined || value.length >= 8, {
      message: "App Password too short",
    }),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const hotel = await prisma.hotel.findUnique({
    where: { id: params.id },
    select: {
      gmailSyncEmail: true,
      gmailSyncEnabled: true,
      gmailSyncLastAt: true,
      gmailSyncLastError: true,
      gmailSyncPasswordEnc: true,
      gmailSyncOffset: true,
    },
  });

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const yearReviews = await prisma.calendarGuestMeta.findMany({
    where: {
      yearNeedsReview: true,
      listing: { hotelId: params.id },
    },
    orderBy: { startDate: "asc" },
    take: 40,
    select: {
      id: true,
      startDate: true,
      endDate: true,
      guestName: true,
      guestCount: true,
      yearReviewNote: true,
      listing: { select: { id: true, title: true } },
    },
  });

  const sheet = await buildGmailReservationSheet(params.id);

  return NextResponse.json({
    email: hotel.gmailSyncEmail,
    connected: Boolean(hotel.gmailSyncEmail && hotel.gmailSyncPasswordEnc),
    enabled: hotel.gmailSyncEnabled,
    lastSyncedAt: hotel.gmailSyncLastAt,
    lastError: hotel.gmailSyncLastError,
    syncOffset: hotel.gmailSyncOffset,
    yearReviews: yearReviews.map((row) => ({
      id: row.id,
      listingId: row.listing.id,
      listingTitle: row.listing.title,
      guestName: row.guestName,
      guestCount: row.guestCount,
      startDate: toDateKey(row.startDate),
      endDate: toDateKey(row.endDate),
      note: row.yearReviewNote,
    })),
    reservations: sheet.rows,
    reservationCounts: sheet.counts,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = saveSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid Gmail address and App Password" },
      { status: 400 }
    );
  }

  const existing = await prisma.hotel.findUnique({
    where: { id: params.id },
    select: { gmailSyncPasswordEnc: true },
  });

  if (!parsed.data.appPassword && !existing?.gmailSyncPasswordEnc) {
    return NextResponse.json(
      { error: "App Password is required for the first connection" },
      { status: 400 }
    );
  }

  await prisma.hotel.update({
    where: { id: params.id },
    data: {
      gmailSyncEmail: parsed.data.email.trim().toLowerCase(),
      ...(parsed.data.appPassword
        ? { gmailSyncPasswordEnc: encryptSecret(parsed.data.appPassword.trim()) }
        : {}),
      gmailSyncEnabled: true,
      gmailSyncLastError: null,
    },
  });

  try {
    const test = await testHotelGmailConnection(params.id);
    return NextResponse.json({
      ok: true,
      connected: true,
      email: parsed.data.email.trim().toLowerCase(),
      message: `Connected to ${test.email}. Inbox has ${test.messages} messages.`,
    });
  } catch (error: any) {
    await prisma.hotel.update({
      where: { id: params.id },
      data: {
        gmailSyncEnabled: false,
        gmailSyncLastError: error?.message || "Connection failed",
      },
    });
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Could not connect. Use a Gmail App Password (not your normal password).",
      },
      { status: 400 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || "sync";

  if (action === "fix-year") {
    const metaId = typeof body.metaId === "string" ? body.metaId : "";
    const year = Number(body.year);
    const confirmOnly = body.confirmOnly === true;
    if (!metaId) {
      return NextResponse.json({ error: "Provide metaId" }, { status: 400 });
    }
    if (
      !confirmOnly &&
      (!Number.isFinite(year) || year < 2020 || year > 2040)
    ) {
      return NextResponse.json(
        { error: "Provide a valid year (2020–2040)" },
        { status: 400 }
      );
    }

    const meta = await prisma.calendarGuestMeta.findFirst({
      where: {
        id: metaId,
        listing: { hotelId: params.id },
      },
    });
    if (!meta) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (confirmOnly) {
      await prisma.calendarGuestMeta.update({
        where: { id: meta.id },
        data: { yearNeedsReview: false, yearReviewNote: null },
      });
      return NextResponse.json({
        ok: true,
        message: "Year confirmed.",
        startDate: meta.startDate.toISOString().slice(0, 10),
        endDate: meta.endDate.toISOString().slice(0, 10),
      });
    }

    const startKey = toDateKey(meta.startDate);
    const endKey = toDateKey(meta.endDate);
    const yearDelta = year - Number(startKey.slice(0, 4));
    const shiftKey = (key: string) => {
      const y = Number(key.slice(0, 4)) + yearDelta;
      return `${y}${key.slice(4)}`;
    };
    const startDate = parseDateKey(shiftKey(startKey));
    const endDate = parseDateKey(shiftKey(endKey));

    // Avoid unique collisions if another meta already sits on the new dates.
    const clash = await prisma.calendarGuestMeta.findFirst({
      where: {
        listingId: meta.listingId,
        startDate,
        endDate,
        NOT: { id: meta.id },
      },
    });
    if (clash) {
      return NextResponse.json(
        {
          error: `Another guest record already exists for ${shiftKey(startKey)} → ${shiftKey(endKey)}. Merge or delete one first.`,
        },
        { status: 409 }
      );
    }

    const updated = await prisma.calendarGuestMeta.update({
      where: { id: meta.id },
      data: {
        startDate,
        endDate,
        yearNeedsReview: false,
        yearReviewNote: null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Updated stay year to ${year}.`,
      startDate: toDateKey(updated.startDate),
      endDate: toDateKey(updated.endDate),
    });
  }

  if (action === "disconnect") {
    await prisma.hotel.update({
      where: { id: params.id },
      data: {
        gmailSyncEmail: null,
        gmailSyncPasswordEnc: null,
        gmailSyncEnabled: false,
        gmailSyncLastError: null,
      },
    });
    return NextResponse.json({ ok: true, connected: false });
  }

  if (action === "test") {
    try {
      const test = await testHotelGmailConnection(params.id);
      return NextResponse.json({
        ok: true,
        message: `Connection OK for ${test.email} (${test.messages} inbox messages).`,
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message || "Connection test failed" },
        { status: 400 }
      );
    }
  }

  try {
    const restart = body.restart !== false;
    const result = await syncHotelGmailBookings(params.id, { restart });
    const skipHint =
      result.updated === 0 && result.samples.length
        ? ` Top skips: ${result.samples
            .map((s) => s.reason)
            .filter(Boolean)
            .slice(0, 3)
            .join("; ")}`
        : "";
    const timeoutHint = result.timedOut
      ? " (finished early under Hostinger time limit)"
      : "";
    const sheet = await buildGmailReservationSheet(params.id);
    const gapHint =
      result.gapsFound != null
        ? ` Calendar gaps without guest names: ${result.gapsFound} · emails targeted: ${result.gapsTargeted ?? 0}.`
        : "";
    return NextResponse.json({
      ok: true,
      ...result,
      reservations: sheet.rows,
      reservationCounts: sheet.counts,
      message: `Filled missing guests from email.${gapHint} Scanned ${result.scanned} · updated ${result.updated}${timeoutHint}.${
        result.nextOffset != null && result.updated > 0
          ? " Click Sync again for more gaps."
          : ""
      }${skipHint}`,
    });
  } catch (error: any) {
    console.error("[gmail-sync]", error);
    try {
      await prisma.hotel.update({
        where: { id: params.id },
        data: {
          gmailSyncLastAt: new Date(),
          gmailSyncLastError: error?.message || "Sync failed",
        },
      });
    } catch {
      // ignore secondary failure
    }
    return NextResponse.json(
      { error: error?.message || "Failed to sync Gmail bookings" },
      { status: 500 }
    );
  }
}
