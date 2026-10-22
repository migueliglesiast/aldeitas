import { NextRequest, NextResponse } from "next/server";
import { settleMercadoPagoChallenge } from "@/lib/booking-payment";

export const dynamic = "force-dynamic";

/** Polled by the pay page after the guest's bank verification (3DS) to learn the payment result. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const result = await settleMercadoPagoChallenge(id);
    if (result.state === "done") return NextResponse.json({ ok: true, statusUrl: `/booking/${id}` });
    if (result.state === "failed") return NextResponse.json({ error: result.guestMessage }, { status: 402 });
    if (result.state === "none") return NextResponse.json({ error: "No payment awaiting verification" }, { status: 409 });
    return NextResponse.json({ pending: true, challengeUrl: result.challengeUrl }, { status: 202 });
  } catch (error) {
    console.error("[bookings/pay/challenge]", { bookingId: id }, error);
    return NextResponse.json({ pending: true, challengeUrl: null }, { status: 202 });
  }
}
