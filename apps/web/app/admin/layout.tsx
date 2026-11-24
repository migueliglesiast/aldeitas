import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <>{children}</>;
  return (
    <div className="space-y-6">
      <AdminNav />
      {children}
    </div>
  );
}
