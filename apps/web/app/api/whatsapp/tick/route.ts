import { NextRequest, NextResponse } from "next/server";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";
import { runWhatsappTick } from "@/lib/whatsapp/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.BOOKING_RECONCILE_SECRET;
  if (!secret || req.headers.get("x-booking-reconcile-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isWhatsappConfigured()) return NextResponse.json({ ok: true, skipped: "whatsapp not configured" });
  return NextResponse.json({ ok: true, ...(await runWhatsappTick()) });
}
