import { NextRequest, NextResponse } from "next/server";
import {
  cancelBookingForExpiredCheckout,
  markBookingAuthorizedFromPaymentOrder,
} from "@/lib/booking-payment";
import { getConektaBookingIdFromOrder, getConektaOrder } from "@/lib/payment-providers/conekta";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!process.env.CONEKTA_PRIVATE_KEY) {
    return NextResponse.json({ error: "Conekta webhook is not configured" }, { status: 400 });
  }

  let event: any;
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const eventType = event?.type;
  const order = event?.data?.object;

  if (eventType === "order.pre_authorized" && order?.id) {
    const bookingId = getConektaBookingIdFromOrder(order);
    try {
      await markBookingAuthorizedFromPaymentOrder("conekta", order.id, bookingId);
    } catch (error) {
      console.error("[conekta/webhook] Failed to authorize booking:", error);
    }
  }

  if (eventType === "order.canceled" && order?.id) {
    const bookingId = getConektaBookingIdFromOrder(order);
    if (bookingId) {
      await cancelBookingForExpiredCheckout(bookingId);
    }
  }

  if (eventType === "order.paid" && order?.id) {
    const bookingId = getConektaBookingIdFromOrder(order);
    if (bookingId) {
      try {
        const latest = await getConektaOrder(order.id);
        await markBookingAuthorizedFromPaymentOrder("conekta", latest.id, bookingId);
      } catch (error) {
        console.error("[conekta/webhook] Failed to process paid order:", error);
      }
    }
  }

  return NextResponse.json({ received: true });
}
