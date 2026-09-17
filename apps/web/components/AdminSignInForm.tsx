"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/auth-redirect";

export default function AdminSignInForm() {
  const searchParams = useSearchParams();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_or_username: emailOrUsername, password }),
    });

    if (res.ok) {
      const next = safeNextPath(searchParams.get("next"), "/admin");
      window.location.href = next;
      return;
    }

    let data: { error?: string } = {};
    try {
      data = await res.json();
    } catch {
      const txt = await res.text();
      data = { error: txt || "Failed to sign in" };
    }
    setError(data.error || "Failed to sign in");
    setLoading(false);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">Admin sign in</h1>
        <p className="mb-6 text-sm text-gray-600">
          Sign in to manage your hotels and bookings.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="emailOrUsername" className="mb-1 block text-sm font-medium text-gray-700">
              Email or username
            </label>
            <input
              id="emailOrUsername"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-[#00a19c] focus:outline-none focus:ring-1 focus:ring-[#00a19c]"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-[#00a19c] px-4 py-2 font-medium text-white hover:bg-[#008a86] disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
