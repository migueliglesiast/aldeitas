import { NextRequest, NextResponse } from "next/server";
import { markBookingAuthorizedFromPaymentOrder } from "@/lib/booking-payment";
import { isMercadoPagoOrderAuthorized } from "@/lib/payment-providers/mercadopago";

export async function POST(req: NextRequest) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Mercado Pago webhook is not configured" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const topic = payload?.type || payload?.action || req.nextUrl.searchParams.get("topic");
  const order = payload?.data || payload;

  if (
    (topic === "order" || topic === "mp-connect") &&
    order?.id &&
    isMercadoPagoOrderAuthorized(order)
  ) {
    const bookingId = order.external_reference;
    try {
      await markBookingAuthorizedFromPaymentOrder("mercadopago", order.id, bookingId);
    } catch (error) {
      console.error("[mercadopago/webhook] Failed to authorize booking:", error);
    }
  }

  return NextResponse.json({ received: true });
}
