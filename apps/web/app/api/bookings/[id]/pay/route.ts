import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { markBookingAuthorizedForBooking } from "@/lib/booking-payment";
import { isMercadoPagoConfigured } from "@/lib/payment-providers/config";
import { createMercadoPagoCardAuthorization } from "@/lib/payment-providers";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    token: z.string().min(1),
    paymentMethodId: z.string().min(1).optional(),
    payment_method_id: z.string().min(1).optional(),
    installments: z.coerce.number().int().min(1).max(24).optional(),
  })
  .refine((data) => Boolean(data.paymentMethodId || data.payment_method_id), {
    message: "paymentMethodId is required",
  });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({ error: "Mercado Pago is not configured" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    console.error("[bookings/pay] Invalid payload:", parsed.error.flatten());
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const paymentMethodId = parsed.data.paymentMethodId || parsed.data.payment_method_id!;

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "PENDING" || booking.authorizedAt) {
    return NextResponse.json({ error: "Booking is not awaiting payment" }, { status: 409 });
  }

  try {
    const authorization = await createMercadoPagoCardAuthorization({
      bookingId: booking.id,
      amountCents: booking.totalPriceCents,
      currency: booking.currency,
      payerEmail: booking.guestEmail,
      cardToken: parsed.data.token,
      paymentMethodId,
      installments: parsed.data.installments,
    });

    await markBookingAuthorizedForBooking(
      booking.id,
      "mercadopago",
      authorization.orderId,
      authorization.referenceId
    );

    return NextResponse.json({
      ok: true,
      statusUrl: `/booking/${booking.id}`,
    });
  } catch (error: any) {
    console.error("[bookings/pay]", error);
    return NextResponse.json(
      { error: error?.message || "Payment authorization failed" },
      { status: 402 }
    );
  }
}
