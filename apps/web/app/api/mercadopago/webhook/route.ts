import { NextRequest, NextResponse } from "next/server";
import { markBookingAuthorizedFromPaymentOrder } from "@/lib/booking-payment";
import {
  getMercadoPagoOrder,
  isMercadoPagoOrderAuthorized,
} from "@/lib/payment-providers/mercadopago";
import { isValidMercadoPagoSignature } from "@/lib/payment-providers/mercadopago-webhook";

export const dynamic = "force-dynamic";

type MercadoPagoNotification = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

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
    const order = await getMercadoPagoOrder(dataId);
    if (isMercadoPagoOrderAuthorized(order)) {
      await markBookingAuthorizedFromPaymentOrder(
        "mercadopago",
        order.id,
        order.external_reference || undefined
      );
    }
  } catch (error) {
    console.error("[mercadopago/webhook] Failed to process order notification:", error);
  }

  return NextResponse.json({ received: true });
}
