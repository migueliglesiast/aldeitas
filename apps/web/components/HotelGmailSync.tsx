"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  hotelId: string;
};

type YearReview = {
  id: string;
  listingId: string;
  listingTitle: string;
  guestName: string | null;
  guestCount: number | null;
  startDate: string;
  endDate: string;
  note: string | null;
};

type ReservationRow = {
  id: string;
  kind: "email" | "ical_only";
  status: "complete" | "partial" | "unassigned";
  listingId: string | null;
  listingTitle: string;
  guestName: string | null;
  guestCount: number | null;
  startDate: string;
  endDate: string;
  payoutCents: number | null;
  payoutCurrency: string | null;
  icalMatched: boolean;
  missing: string[];
  note: string | null;
  yearNeedsReview: boolean;
};

type Status = {
  email: string | null;
  connected: boolean;
  enabled: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  syncOffset?: number;
  yearReviews?: YearReview[];
  reservations?: ReservationRow[];
  reservationCounts?: {
    complete: number;
    partial: number;
    unassigned: number;
  };
};

async function readApiJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 160);
    if (res.status >= 500) {
      throw new Error(
        `Server error (${res.status}). Sync may have timed out on Hostinger — try again, or use Test connection first.`
      );
    }
    throw new Error(
      `Unexpected server response (${res.status}): ${snippet || "empty body"}`
    );
  }
}

function yearOptionsAround(isoDate: string): number[] {
  const y = Number(isoDate.slice(0, 4));
  if (!Number.isFinite(y)) {
    const now = new Date().getFullYear();
    return [now - 1, now, now + 1];
  }
  return [y - 1, y, y + 1];
}

function formatMoney(cents: number | null, currency: string | null) {
  if (cents == null) return "—";
  const amount = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${amount}` : `$${amount}`;
}

function statusStyles(status: ReservationRow["status"]) {
  if (status === "complete") {
    return {
      row: "bg-emerald-50/90",
      badge: "bg-emerald-600 text-white",
      label: "Complete",
    };
  }
  if (status === "partial") {
    return {
      row: "bg-amber-50/90",
      badge: "bg-amber-500 text-white",
      label: "Partial",
    };
  }
  return {
    row: "bg-red-50/90",
    badge: "bg-red-600 text-white",
    label: "Unassigned",
  };
}

export default function HotelGmailSync({ hotelId }: Props) {
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [yearEdits, setYearEdits] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<
    "all" | "complete" | "partial" | "unassigned"
  >("all");

  const loadStatus = useCallback(async () => {
    const res = await fetch(`/api/admin/hotel/${hotelId}/gmail-sync`);
    const json = await readApiJson(res);
    if (res.ok) {
      setStatus(json);
      if (json.email) setEmail(json.email);
      const reviews = Array.isArray(json.yearReviews) ? json.yearReviews : [];
      setYearEdits((prev) => {
        const next = { ...prev };
        for (const row of reviews as YearReview[]) {
          if (next[row.id] == null) {
            next[row.id] = Number(row.startDate.slice(0, 4));
          }
        }
        return next;
      });
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
      const json = await readApiJson(res);
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
        body: JSON.stringify({
          action,
          ...(action === "sync" ? { restart: true } : {}),
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw new Error(json.error || "Action failed");
      setMessage(
        json.message || (action === "disconnect" ? "Disconnected." : "Done.")
      );
      if (action === "sync") {
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                reservations: json.reservations || prev.reservations,
                reservationCounts:
                  json.reservationCounts || prev.reservationCounts,
                lastSyncedAt: new Date().toISOString(),
                lastError: json.timedOut
                  ? prev.lastError
                  : json.updated > 0
                    ? null
                    : prev.lastError,
              }
            : prev
        );
      }
      await loadStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function fixYear(metaId: string, opts?: { confirmOnly?: boolean }) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hotel/${hotelId}/gmail-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fix-year",
          metaId,
          ...(opts?.confirmOnly
            ? { confirmOnly: true }
            : { year: yearEdits[metaId] }),
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw new Error(json.error || "Could not update year");
      setMessage(json.message || "Year updated.");
      await loadStatus();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update year");
    } finally {
      setBusy(false);
    }
  }

  const messageLooksBad =
    !!message &&
    /fail|could not|error|unexpected|server error|already exists/i.test(
      message
    ) &&
    !/updated [1-9]|year confirmed|updated stay year/i.test(message);

  const lastErrorLooksPartial =
    !!status?.lastError && /partial sync|time limit/i.test(status.lastError);

  const yearReviews = status?.yearReviews || [];
  const reservations = status?.reservations || [];
  const counts = status?.reservationCounts || {
    complete: 0,
    partial: 0,
    unassigned: 0,
  };

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return reservations;
    return reservations.filter((row) => row.status === statusFilter);
  }, [reservations, statusFilter]);

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Airbnb booking emails (Gmail)</h2>
        <p className="mt-1 text-sm text-gray-600">
          Connect a Gmail inbox with an{" "}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            App Password
          </a>
          . Guest names fill automatically when you open the calendar (and via cron). Use the button
          below only if you want to force another pass now.
        </p>
      </div>

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
          {busy ? "Working…" : "Fill missing calendar guests"}
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
                <div
                  className={`mt-1 ${
                    lastErrorLooksPartial ? "text-amber-700" : "text-red-600"
                  }`}
                >
                  {lastErrorLooksPartial ? "Note: " : "Last error: "}
                  {status.lastError}
                </div>
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
            messageLooksBad ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      {yearReviews.length > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50/60 px-3 py-3 space-y-3">
          <div>
            <div className="font-medium text-amber-950">
              Check stay year ({yearReviews.length})
            </div>
            <p className="mt-0.5 text-xs text-amber-900/80">
              These stays looked uncertain. Confirm or change the check-in year — checkout shifts
              with it.
            </p>
          </div>
          <ul className="space-y-3">
            {yearReviews.map((row) => {
              const options = yearOptionsAround(row.startDate);
              const selected = yearEdits[row.id] ?? Number(row.startDate.slice(0, 4));
              return (
                <li
                  key={row.id}
                  className="rounded border border-amber-200/80 bg-white px-3 py-2 text-sm"
                >
                  <div className="font-medium text-gray-900">
                    {row.guestName || "Guest"}
                    {row.guestCount != null ? ` · ${row.guestCount} guests` : ""}
                  </div>
                  <div className="text-gray-600">
                    {row.listingTitle} · {row.startDate} → {row.endDate}
                  </div>
                  {row.note ? (
                    <div className="mt-1 text-xs text-amber-800">{row.note}</div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-xs text-gray-600">
                      Check-in year
                      <select
                        className="ml-2 rounded border px-2 py-1 text-sm"
                        value={selected}
                        onChange={(event) =>
                          setYearEdits((prev) => ({
                            ...prev,
                            [row.id]: Number(event.target.value),
                          }))
                        }
                      >
                        {options.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void fixYear(row.id)}
                      className="rounded bg-amber-800 px-3 py-1.5 text-xs text-white hover:bg-amber-900 disabled:opacity-50"
                    >
                      Save year
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void fixYear(row.id, { confirmOnly: true })}
                      className="rounded border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Looks correct
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Reservation sheet</h3>
            <p className="text-xs text-gray-600">
              Green = complete and linked to iCal · Yellow = partial · Red = not linked to an iCal
              stay (or calendar bar with no email yet)
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                ["all", `All (${reservations.length})`],
                ["complete", `Green (${counts.complete})`],
                ["partial", `Yellow (${counts.partial})`],
                ["unassigned", `Red (${counts.unassigned})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded border px-2.5 py-1 ${
                  statusFilter === value
                    ? "border-gray-800 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded border">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Guest</th>
                <th className="px-3 py-2 font-medium">Room</th>
                <th className="px-3 py-2 font-medium">Check-in</th>
                <th className="px-3 py-2 font-medium">Checkout</th>
                <th className="px-3 py-2 font-medium">Guests</th>
                <th className="px-3 py-2 font-medium">Payout</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    No reservations yet. Connect Gmail and run Sync to populate this sheet.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const styles = statusStyles(row.status);
                  return (
                    <tr key={row.id} className={`border-t ${styles.row}`}>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${styles.badge}`}
                        >
                          {styles.label}
                        </span>
                        {row.kind === "ical_only" ? (
                          <div className="mt-1 text-[11px] text-red-700">iCal only</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top font-medium text-gray-900">
                        {row.guestName || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-gray-700">{row.listingTitle}</td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">{row.startDate}</td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">{row.endDate}</td>
                      <td className="px-3 py-2 align-top">
                        {row.guestCount != null ? row.guestCount : "—"}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        {formatMoney(row.payoutCents, row.payoutCurrency)}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-gray-600">
                        {row.missing.length
                          ? `Missing: ${row.missing.join(", ")}`
                          : row.note || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
