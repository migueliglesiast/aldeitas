import { NextRequest, NextResponse } from "next/server";
import {
  buildHotelCalendarData,
  getHotelIdForShareToken,
} from "@/lib/hotel-calendar-data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
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
    leadDays: 1,
    timeZone: "America/Mexico_City",
  });

  if (!data) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
