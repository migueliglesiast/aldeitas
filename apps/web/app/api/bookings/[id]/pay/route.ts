import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  finalizeCapturedBooking,
  markBookingAuthorizedForBooking,
  verifyBookingDatesAvailable,
} from "@/lib/booking-payment";
import { isMercadoPagoConfigured } from "@/lib/payment-providers/config";
import { createMercadoPagoCardAuthorization } from "@/lib/payment-providers";
import {
  guestPaymentErrorMessage,
  MercadoPagoPaymentError,
  resolveCardPaymentMethod,
} from "@/lib/payment-providers/mercadopago";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    token: z.string().min(1),
    paymentMethodId: z.string().min(1).optional(),
    payment_method_id: z.string().min(1).optional(),
    paymentTypeId: z.string().max(40).optional(),
    payment_type_id: z.string().max(40).optional(),
    installments: z.coerce.number().int().min(1).max(24).optional(),
  })
  .refine((data) => Boolean(data.paymentMethodId || data.payment_method_id), {
    message: "paymentMethodId is required",
  });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({ error: "Mercado Pago is not configured" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    console.error("[bookings/pay] Invalid payload:", parsed.error.flatten());
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const paymentMethodId = parsed.data.paymentMethodId || parsed.data.payment_method_id!;
  const paymentTypeId = parsed.data.paymentTypeId || parsed.data.payment_type_id || null;
  const method = resolveCardPaymentMethod(paymentMethodId, paymentTypeId);

  const booking = await prisma.booking.findUnique({
    where: { id: id },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "PENDING" || booking.authorizedAt) {
    return NextResponse.json({ error: "Booking is not awaiting payment" }, { status: 409 });
  }

  // Cards that can't be reserved are charged at once, so the dates are re-checked first.
  let snapshot: string | null = null;
  if (!method.manualCapture) {
    const dates = await verifyBookingDatesAvailable(booking.id);
    if (!dates.ok) {
      return NextResponse.json(
        {
          error:
            dates.reason === "unverifiable"
              ? "No pudimos confirmar el calendario ahora mismo; no se hizo ningún cargo. Intenta en unos minutos. / We couldn't check the calendar right now; nothing was charged. Please try again in a few minutes."
              : "Esas fechas ya no están disponibles; no se hizo ningún cargo. / Those dates are no longer available; nothing was charged.",
        },
        { status: 409 }
      );
    }
    snapshot = dates.snapshot;
  }

  let authorization: Awaited<ReturnType<typeof createMercadoPagoCardAuthorization>>;
  try {
    authorization = await createMercadoPagoCardAuthorization({
      bookingId: booking.id,
      amountCents: booking.totalPriceCents,
      currency: booking.currency,
      payerEmail: booking.guestEmail,
      cardToken: parsed.data.token,
      paymentMethodId: method.id,
      paymentTypeId: method.type,
      installments: parsed.data.installments,
    });
  } catch (error) {
    console.error("[bookings/pay]", { bookingId: booking.id, paymentMethodId, paymentTypeId }, error);
    const guestMessage =
      error instanceof MercadoPagoPaymentError ? error.guestMessage : guestPaymentErrorMessage(null);
    return NextResponse.json({ error: guestMessage }, { status: 402 });
  }

  try {
    if (authorization.captured) {
      await finalizeCapturedBooking(
        booking.id,
        "mercadopago",
        authorization.orderId,
        authorization.referenceId,
        snapshot ?? "[]"
      );
    } else {
      await markBookingAuthorizedForBooking(
        booking.id,
        "mercadopago",
        authorization.orderId,
        authorization.referenceId
      );
    }
  } catch (error) {
    console.error("[bookings/pay] Payment accepted but booking update failed", {
      bookingId: booking.id,
      orderId: authorization.orderId,
    }, error);
  }

  return NextResponse.json({
    ok: true,
    statusUrl: `/booking/${booking.id}`,
  });
}
