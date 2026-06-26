import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminBookingsPanel from "@/components/AdminBookingsPanel";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(signInUrl("/admin/bookings"));
  }

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-[#00a19c] hover:underline">
        ← Back to admin
      </Link>
      <AdminBookingsPanel />
    </div>
  );
}
