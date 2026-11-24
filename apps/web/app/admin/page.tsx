import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import NicknameEditor from "@/components/NicknameEditor";
import AdminSignInForm from "@/components/AdminSignInForm";
import { OpenTourButton } from "@/components/onboarding/OwnerOnboarding";
import AdminHome from "@/components/admin/AdminHome";
import { isActiveHotel, loadAdminOverview } from "@/lib/admin-overview";
import AdminCalendarSection, { AdminCalendarSkeleton } from "@/components/admin/AdminCalendarSection";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Suspense fallback={<div className="mx-auto max-w-md text-center text-gray-500">Loading...</div>}>
        <AdminSignInForm />
      </Suspense>
    );
  }

  const overview = await loadAdminOverview(user.id);
  return (
    <AdminHome
      name={user.nickname || user.fullName || user.username || ""}
      overview={overview}
      tourButton={<OpenTourButton className="self-start rounded-lg border border-aldeitas/30 bg-white px-4 py-2 text-sm font-medium text-aldeitas hover:bg-aldeitas/5 sm:self-auto" />}
      nicknameEditor={!user.nickname ? <NicknameEditor /> : null}
      calendar={
        <Suspense fallback={<AdminCalendarSkeleton />}>
          <AdminCalendarSection hotelIds={overview.hotels.filter(isActiveHotel).map((h) => h.id)} />
        </Suspense>
      }
    />
  );
}
