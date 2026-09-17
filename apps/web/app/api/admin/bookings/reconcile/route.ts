import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reconcileBooking, reconcilePendingBookings } from "@/lib/booking-reconcile";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookingId = req.nextUrl.searchParams.get("bookingId");
    if (bookingId) {
      const result = await reconcileBooking(bookingId);
      return NextResponse.json({ results: [result] });
    }

    const results = await reconcilePendingBookings();
    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("[admin/bookings/reconcile]", error);
    return NextResponse.json(
      { error: error?.message || "Reconcile failed" },
      { status: 500 }
    );
  }
}
