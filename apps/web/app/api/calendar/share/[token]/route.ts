import { NextRequest, NextResponse } from "next/server";
import {
  buildHotelCalendarData,
  getHotelIdForShareToken,
  parsePastDaysParam,
} from "@/lib/hotel-calendar-data";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const hotelId = await getHotelIdForShareToken(token);
  if (!hotelId) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const data = await buildHotelCalendarData(hotelId, {
    includeGuestDetails: true,
    readOnly: true,
    pastDays: parsePastDaysParam(req.nextUrl.searchParams.get("past")),
  });

  if (!data) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...data,
    rooms: data.rooms.map((room) => ({
      ...room,
      spans: room.spans.map((span) => ({ ...span, payoutCents: null, payoutCurrency: null })),
    })),
  });
}
