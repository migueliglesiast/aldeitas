import { NextRequest, NextResponse } from "next/server";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { buildHotelCalendarData } from "@/lib/hotel-calendar-data";
import {
  getHotelCalendarShare,
  getHotelCalendarShareUrl,
  getOrCreateHotelCalendarShare,
  setHotelCalendarPin,
} from "@/lib/calendar-share";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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

  const share = await getHotelCalendarShare(params.id);

  return NextResponse.json({
    ...data,
    shareUrl: share?.slug ? getHotelCalendarShareUrl(share.slug) : null,
  });
}

export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === "share") {
    const share = await getOrCreateHotelCalendarShare(params.id);
    return NextResponse.json({
      url: getHotelCalendarShareUrl(share.slug as string),
    });
  }

  if (body.action === "pin") {
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    try {
      const share = await setHotelCalendarPin(params.id, pin);
      return NextResponse.json({
        ok: true,
        url: getHotelCalendarShareUrl(share.slug as string),
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid PIN" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
