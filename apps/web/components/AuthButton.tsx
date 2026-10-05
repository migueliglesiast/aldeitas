"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";

type User = { id: string; username: string; email: string; verified?: boolean } | null;

export default function AuthButton() {
  const { t } = useLocale();
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) return { user: null };
        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("application/json")) return { user: null };
        try {
          return await r.json();
        } catch {
          return { user: null };
        }
      })
      .then((d) => {
        if (!isMounted) return;
        setUser(d?.user ?? null);
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
      })
      .finally(() => setLoading(false));
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <div className="h-9 w-24 animate-pulse rounded bg-gray-100" />;

  if (!user) {
    return (
      <Link href="/sign-in" className="rounded-full bg-heading px-4 py-2 text-sm font-semibold text-white hover:bg-ink">{t("hostPortal")}</Link>
    );
  }

  async function onSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600">{t("hiUser", { name: user.username })}</span>
      <button onClick={onSignOut} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface">{t("signOut")}</button>
    </div>
  );
}


