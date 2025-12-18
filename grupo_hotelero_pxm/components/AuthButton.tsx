"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type User = { id: string; username: string; email: string; verified?: boolean } | null;

export default function AuthButton() {
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
      <div className="flex gap-2">
        <Link href="/sign-in" className="rounded border px-3 py-2 hover:bg-gray-50">Sign in</Link>
        <Link href="/sign-up" className="rounded bg-[#00a19c] px-3 py-2 text-white hover:bg-[#008a86]">Sign up</Link>
      </div>
    );
  }

  async function onSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600">Hi, {user.username}</span>
      <button onClick={onSignOut} className="rounded border px-3 py-2 hover:bg-gray-50">Sign out</button>
    </div>
  );
}


