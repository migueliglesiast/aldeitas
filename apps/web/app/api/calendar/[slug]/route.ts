import { NextRequest, NextResponse } from "next/server";
import { buildHotelCalendarData } from "@/lib/hotel-calendar-data";
import {
  calendarAccessCookieName,
  getHotelCalendarShareBySlug,
  hasCalendarAccess,
} from "@/lib/calendar-share";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const share = await getHotelCalendarShareBySlug(slug);
  if (!share) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }
  if (!hasCalendarAccess(share, req.cookies.get(calendarAccessCookieName(share))?.value)) {
    return NextResponse.json({ error: "PIN required" }, { status: 401 });
  }

  const data = await buildHotelCalendarData(share.hotelId, {
    includeGuestDetails: true,
    readOnly: true,
    leadDays: 1,
    timeZone: "America/Mexico_City",
  });

  if (!data) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
