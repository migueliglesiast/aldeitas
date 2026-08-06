"use client";
import { useState } from "react";
import Link from "next/link";

export default function SignInPage() {
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
      window.location.href = "/";
    } else {
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        const txt = await res.text();
        data = { error: txt || "Failed to sign in" };
      }
      setError(typeof data.error === "string" ? data.error : "Failed to sign in");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Email or username"
          value={emailOrUsername}
          onChange={(e) => setEmailOrUsername(e.target.value)}
        />
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button disabled={loading} className="w-full rounded bg-[#00a19c] px-3 py-2 text-white hover:bg-[#008a86] disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-3 text-sm text-gray-600">
        Dont have an account? <Link className="text-black underline" href="/sign-up">Sign up</Link>
      </p>
    </div>
  );
}


