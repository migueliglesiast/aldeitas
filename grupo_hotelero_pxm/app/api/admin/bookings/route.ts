import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatAdminBooking(booking: {
  id: string;
  status: string;
  guestEmail: string;
  guestPhone: string;
  startDate: Date;
  endDate: Date;
  totalPriceCents: number;
  currency: string;
  paymentProvider: string | null;
  paymentOrderId: string | null;
  authorizedAt: Date | null;
  confirmedAt: Date | null;
  pendingExpiresAt: Date | null;
  cancelReason: string | null;
  lastReconciledAt: Date | null;
  createdAt: Date;
  listing: {
    id: string;
    title: string;
    hotel: { id: string; name: string };
  };
}) {
  const isAwaitingPayment = booking.status === "PENDING" && !booking.authorizedAt;
  const isProcessing = booking.status === "PENDING" && !!booking.authorizedAt;

  return {
    id: booking.id,
    status: booking.status,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    startDate: booking.startDate.toISOString(),
    endDate: booking.endDate.toISOString(),
    totalPriceCents: booking.totalPriceCents,
    currency: booking.currency,
    paymentProvider: booking.paymentProvider,
    paymentOrderId: booking.paymentOrderId,
    authorizedAt: booking.authorizedAt?.toISOString() ?? null,
    confirmedAt: booking.confirmedAt?.toISOString() ?? null,
    pendingExpiresAt: booking.pendingExpiresAt?.toISOString() ?? null,
    cancelReason: booking.cancelReason,
    lastReconciledAt: booking.lastReconciledAt?.toISOString() ?? null,
    createdAt: booking.createdAt.toISOString(),
    listing: booking.listing,
    isAwaitingPayment,
    isProcessing,
    paymentState: isAwaitingPayment
      ? "awaiting_payment"
      : isProcessing
        ? "authorized"
        : booking.status === "CONFIRMED"
          ? "captured"
          : "released",
    statusLabel: isAwaitingPayment
      ? "Awaiting payment"
      : isProcessing
        ? "Processing"
        : booking.status === "CONFIRMED"
          ? "Confirmed"
          : "Canceled",
    statusUrl: `/booking/${booking.id}`,
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookings = await prisma.booking.findMany({
      include: {
        listing: {
          include: {
            hotel: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = bookings.map(formatAdminBooking);
    const summary = {
      total: formatted.length,
      awaitingPayment: formatted.filter((b) => b.isAwaitingPayment).length,
      processing: formatted.filter((b) => b.isProcessing).length,
      confirmed: formatted.filter((b) => b.status === "CONFIRMED").length,
      canceled: formatted.filter((b) => b.status === "CANCELED").length,
    };

    return NextResponse.json({ bookings: formatted, summary });
  } catch (error: any) {
    console.error("[admin/bookings]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load bookings" },
      { status: 500 }
    );
  }
}
