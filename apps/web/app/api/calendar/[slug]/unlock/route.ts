import { NextRequest, NextResponse } from "next/server";
import {
  calendarAccessCookieName,
  calendarAccessCookieOptions,
  calendarAccessCookieValue,
  getHotelCalendarShareBySlug,
  verifyCalendarPin,
} from "@/lib/calendar-share";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const share = await getHotelCalendarShareBySlug(slug);
  if (!share) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  const result = await verifyCalendarPin(share, pin);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, retryAfterSeconds: result.retryAfterSeconds },
      { status: result.reason === "locked" ? 429 : 401 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    calendarAccessCookieName(result.share),
    calendarAccessCookieValue(result.share),
    calendarAccessCookieOptions()
  );
  return res;
}
