import { NextRequest, NextResponse } from "next/server";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import {
  buildHotelCalendarData,
  getHotelCalendarShareUrl,
  getOrCreateHotelCalendarShareToken,
} from "@/lib/hotel-calendar-data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const data = await buildHotelCalendarData(params.id, {
    includeGuestDetails: true,
    readOnly: false,
  });

  if (!data) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === "share") {
    const share = await getOrCreateHotelCalendarShareToken(params.id);
    return NextResponse.json({
      token: share.token,
      url: getHotelCalendarShareUrl(share.token),
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
