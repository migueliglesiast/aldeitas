import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import BookingProgressMap from "@/components/BookingProgressMap";

export const dynamic = "force-dynamic";

export default async function AdminBookingProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(signInUrl(`/admin/bookings/${id}`));

  return (
    <div className="space-y-6">
      <Link href="/admin/bookings" className="text-sm text-[#00a19c] hover:underline">
        ← Reservas / Bookings
      </Link>
      <BookingProgressMap bookingId={id} />
    </div>
  );
}
