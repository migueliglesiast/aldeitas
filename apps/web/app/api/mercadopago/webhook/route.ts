import { NextRequest, NextResponse } from "next/server";
import { markBookingAuthorizedFromPaymentOrder, settleMercadoPagoChallenge } from "@/lib/booking-payment";
import {
  getMercadoPagoOrder,
  isMercadoPagoOrderAuthorized,
  isMercadoPagoOrderCaptured,
  isMercadoPagoOrderFinalFailure,
} from "@/lib/payment-providers/mercadopago";
import { isValidMercadoPagoSignature } from "@/lib/payment-providers/mercadopago-webhook";
import { getBookingMercadoPagoToken, getHotelMercadoPagoMerchant } from "@/lib/mercadopago-merchant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type MercadoPagoNotification = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
  user_id?: string | number;
};

/** Orders charged on a connected hotel's account must be read with that hotel's token. */
async function resolveOrderToken(orderId: string, collectorId: string | null) {
  const booking = await prisma.booking.findFirst({
    where: { paymentOrderId: orderId },
    select: { paymentMerchantHotelId: true },
  });
  if (booking) return getBookingMercadoPagoToken(booking);
  if (!collectorId) return undefined;
  const hotel = await prisma.hotel.findFirst({ where: { mercadoPagoUserId: collectorId }, select: { id: true } });
  return hotel ? (await getHotelMercadoPagoMerchant(hotel.id))?.accessToken : undefined;
}

export async function POST(req: NextRequest) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Mercado Pago webhook is not configured" }, { status: 400 });
  }

  let payload: MercadoPagoNotification;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const dataId =
    req.nextUrl.searchParams.get("data.id") ??
    (payload?.data?.id != null ? String(payload.data.id) : null);

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (
    secret &&
    !isValidMercadoPagoSignature({
      signature: req.headers.get("x-signature"),
      requestId: req.headers.get("x-request-id"),
      dataId,
      secret,
    })
  ) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const topic = payload?.type || req.nextUrl.searchParams.get("type");
  if (topic !== "order" || !dataId) {
    return NextResponse.json({ received: true });
  }

  try {
    const collectorId = payload?.user_id != null ? String(payload.user_id) : null;
    const order = await getMercadoPagoOrder(dataId, await resolveOrderToken(dataId, collectorId));
    if (isMercadoPagoOrderAuthorized(order)) {
      await markBookingAuthorizedFromPaymentOrder(
        "mercadopago",
        order.id,
        order.external_reference || undefined
      );
    } else if (
      order.external_reference &&
      (isMercadoPagoOrderCaptured(order) || isMercadoPagoOrderFinalFailure(order))
    ) {
      await settleMercadoPagoChallenge(order.external_reference);
    }
  } catch (error) {
    console.error("[mercadopago/webhook] Failed to process order notification:", error);
  }

  return NextResponse.json({ received: true });
}
