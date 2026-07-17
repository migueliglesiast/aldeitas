import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { encryptSecret } from "@/lib/secret-crypto";
import {
  syncHotelGmailBookings,
  testHotelGmailConnection,
} from "@/lib/gmail-booking-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
    },
  });

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  return NextResponse.json({
    email: hotel.gmailSyncEmail,
    connected: Boolean(hotel.gmailSyncEmail && hotel.gmailSyncPasswordEnc),
    enabled: hotel.gmailSyncEnabled,
    lastSyncedAt: hotel.gmailSyncLastAt,
    lastError: hotel.gmailSyncLastError,
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
    const result = await syncHotelGmailBookings(params.id);
    return NextResponse.json({
      ok: true,
      ...result,
      message: `Scanned ${result.scanned} Airbnb emails · updated ${result.updated} reservation(s).`,
    });
  } catch (error: any) {
    await prisma.hotel.update({
      where: { id: params.id },
      data: {
        gmailSyncLastAt: new Date(),
        gmailSyncLastError: error?.message || "Sync failed",
      },
    });
    return NextResponse.json(
      { error: error?.message || "Failed to sync Gmail bookings" },
      { status: 500 }
    );
  }
}
