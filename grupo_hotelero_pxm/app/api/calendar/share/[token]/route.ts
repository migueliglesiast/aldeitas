import { NextRequest, NextResponse } from "next/server";
import {
  buildHotelCalendarData,
  getHotelIdForShareToken,
} from "@/lib/hotel-calendar-data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const hotelId = await getHotelIdForShareToken(params.token);
  if (!hotelId) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const data = await buildHotelCalendarData(hotelId, {
    includeGuestDetails: false,
    readOnly: true,
  });

  if (!data) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
