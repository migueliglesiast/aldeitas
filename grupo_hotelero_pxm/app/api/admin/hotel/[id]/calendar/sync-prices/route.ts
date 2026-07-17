import { NextRequest, NextResponse } from "next/server";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { syncHotelAirbnbPrices } from "@/lib/sync-airbnb-prices";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireHotelManager(params.id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const months =
    typeof body.months === "number" && body.months >= 1 && body.months <= 6
      ? body.months
      : 3;
  const sampleEvery =
    typeof body.sampleEvery === "number" && body.sampleEvery >= 1
      ? body.sampleEvery
      : 2;

  try {
    const result = await syncHotelAirbnbPrices(params.id, {
      months,
      sampleEvery,
    });
    const updatedRooms = result.rooms.filter((room) => room.updatedDays > 0);
    return NextResponse.json({
      ok: true,
      ...result,
      summary: `Updated prices for ${updatedRooms.length} of ${result.rooms.length} rooms.`,
    });
  } catch (error: any) {
    console.error("[sync-airbnb-prices]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to sync Airbnb prices" },
      { status: 500 }
    );
  }
}
