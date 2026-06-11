import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminBookingsPanel from "@/components/AdminBookingsPanel";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
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
