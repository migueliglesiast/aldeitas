import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import { redirect } from "next/navigation";
import AdminBookingsPanel from "@/components/AdminBookingsPanel";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(signInUrl("/admin/bookings"));
  }

  return (
    <div className="space-y-6">
      <AdminBookingsPanel />
    </div>
  );
}
