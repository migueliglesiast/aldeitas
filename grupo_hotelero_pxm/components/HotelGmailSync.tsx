"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  hotelId: string;
};

type Status = {
  email: string | null;
  connected: boolean;
  enabled: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export default function HotelGmailSync({ hotelId }: Props) {
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await fetch(`/api/admin/hotel/${hotelId}/gmail-sync`);
    const json = await res.json();
    if (res.ok) {
      setStatus(json);
      if (json.email) setEmail(json.email);
    }
  }, [hotelId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function connect() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hotel/${hotelId}/gmail-sync`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          ...(appPassword.trim() ? { appPassword: appPassword.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to connect Gmail");
      setAppPassword("");
      setMessage(json.message || "Gmail connected.");
      await loadStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to connect Gmail");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "sync" | "test" | "disconnect") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hotel/${hotelId}/gmail-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      setMessage(json.message || (action === "disconnect" ? "Disconnected." : "Done."));
      await loadStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Airbnb booking emails (Gmail)</h2>
        <p className="mt-1 text-sm text-gray-600">
          Aldeitas cannot turn on Gmail forwarding for you (Google blocks that). Instead, connect a
          Gmail inbox with an{" "}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            App Password
          </a>{" "}
          so we can read Airbnb reservation emails and fill guest name + guest count on the
          calendar.
        </p>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
        <li>Enable 2-Step Verification on the Gmail account that receives Airbnb emails.</li>
        <li>
          Create an App Password at{" "}
          <span className="font-medium">myaccount.google.com/apppasswords</span> (select Mail).
        </li>
        <li>Paste the Gmail address and 16-character App Password below, then Connect.</li>
        <li>Optional: in Gmail, filter Airbnb mail into that inbox (or forward hotel Airbnb mail there).</li>
      </ol>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Gmail address</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="bookings@gmail.com"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            App Password {status?.connected ? "(leave blank to keep current)" : ""}
          </label>
          <input
            type="password"
            value={appPassword}
            onChange={(event) => setAppPassword(event.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="xxxx xxxx xxxx xxxx"
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !email || (!appPassword && !status?.connected)}
          onClick={() => void connect()}
          className="rounded bg-[#00a19c] px-4 py-2 text-sm text-white hover:bg-[#008a86] disabled:opacity-50"
        >
          {status?.connected ? "Update connection" : "Connect Gmail"}
        </button>
        <button
          type="button"
          disabled={busy || !status?.connected}
          onClick={() => void runAction("sync")}
          className="rounded border border-[#00a19c] px-4 py-2 text-sm text-[#008a86] hover:bg-[#e8f6f5] disabled:opacity-50"
        >
          Sync booking emails now
        </button>
        <button
          type="button"
          disabled={busy || !status?.connected}
          onClick={() => void runAction("test")}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Test connection
        </button>
        <button
          type="button"
          disabled={busy || !status?.connected}
          onClick={() => void runAction("disconnect")}
          className="rounded border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>

      {status ? (
        <div className="rounded border bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {status.connected ? (
            <>
              Connected as <span className="font-medium">{status.email}</span>
              {status.lastSyncedAt
                ? ` · Last sync ${new Date(status.lastSyncedAt).toLocaleString()}`
                : " · Not synced yet"}
              {status.lastError ? (
                <div className="mt-1 text-red-600">Last error: {status.lastError}</div>
              ) : null}
            </>
          ) : (
            "Not connected yet."
          )}
        </div>
      ) : null}

      {message ? (
        <div
          className={`rounded px-3 py-2 text-sm ${
            message.toLowerCase().includes("fail") ||
            message.toLowerCase().includes("could not") ||
            message.toLowerCase().includes("error")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
