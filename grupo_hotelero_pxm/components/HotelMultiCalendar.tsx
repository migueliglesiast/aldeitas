"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { formatMoneyShort } from "@/lib/currency";
import type {
  CalendarCell,
  CalendarSpan,
  HotelCalendarPayload,
} from "@/lib/hotel-calendar-data";

type Props = {
  hotelId: string;
  readOnly?: boolean;
  shareToken?: string;
};

type SelectedCell = {
  roomId: string;
  roomTitle: string;
  day: string;
  cell: CalendarCell;
};

type RowSegment =
  | { type: "day"; day: string; cell: CalendarCell }
  | { type: "span"; span: CalendarSpan; days: string[] };

function cellClass(cell: CalendarCell) {
  switch (cell.status) {
    case "manual_block":
      return "bg-slate-300 text-slate-900";
    case "booking":
      return cell.bookingStatus === "CONFIRMED"
        ? "bg-rose-200 text-rose-950"
        : "bg-amber-200 text-amber-950";
    case "external":
      return "bg-violet-200 text-violet-950";
    default:
      return "bg-white text-slate-700 hover:bg-emerald-50";
  }
}

function spanBarClass(span: CalendarSpan) {
  switch (span.kind) {
    case "manual_block":
      return "bg-slate-500 text-white";
    case "external":
      return "bg-[#0f766e] text-white";
    case "booking":
      return span.bookingStatus === "CONFIRMED"
        ? "bg-[#0f766e] text-white"
        : "bg-amber-500 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

function spanTitle(span: CalendarSpan) {
  const name = span.guestName || span.label;
  if (span.guestCount != null && span.guestCount > 0) {
    return `${name} · ${span.guestCount} guest${span.guestCount === 1 ? "" : "s"}`;
  }
  return name;
}

function buildRowSegments(
  days: string[],
  cells: Record<string, CalendarCell>,
  spans: CalendarSpan[]
): RowSegment[] {
  const spanById = new Map(spans.map((span) => [span.id, span] as const));
  const segments: RowSegment[] = [];
  let index = 0;

  while (index < days.length) {
    const day = days[index];
    const cell = cells[day];
    const span = cell?.spanId ? spanById.get(cell.spanId) : undefined;

    if (span && span.startDay === day) {
      const spanDays = days.slice(index, index + span.dayCount);
      segments.push({ type: "span", span, days: spanDays });
      index += spanDays.length;
      continue;
    }

    // Middle/end nights of a multi-day span are covered by the colspan above.
    if (span && span.startDay !== day) {
      index += 1;
      continue;
    }

    segments.push({ type: "day", day, cell });
    index += 1;
  }

  return segments;
}

export default function HotelMultiCalendar({
  hotelId,
  readOnly = false,
  shareToken,
}: Props) {
  const [data, setData] = useState<HotelCalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [basePriceDrafts, setBasePriceDrafts] = useState<Record<string, string>>({});
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = shareToken
        ? `/api/calendar/share/${shareToken}`
        : `/api/admin/hotel/${hotelId}/calendar`;
      const res = await fetch(endpoint);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load calendar");
      setData(json);
      if (json.shareUrl) setShareUrl(json.shareUrl);
      setBasePriceDrafts(
        Object.fromEntries(
          json.rooms.map((room: HotelCalendarPayload["rooms"][number]) => [
            room.id,
            String(Math.round(room.nightlyBasePrice / 100)),
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [hotelId, shareToken]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const monthGroups = useMemo(() => {
    if (!data) return [];
    const groups: Array<{ label: string; days: string[] }> = [];
    for (const day of data.days) {
      const label = new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      const last = groups[groups.length - 1];
      if (last?.label === label) {
        last.days.push(day);
      } else {
        groups.push({ label, days: [day] });
      }
    }
    return groups;
  }, [data]);

  async function handleShareLink() {
    setSharing(true);
    setMessage(null);
    try {
      let url = shareUrl;
      if (!url) {
        const res = await fetch(`/api/admin/hotel/${hotelId}/calendar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "share" }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to create share link");
        }
        url = json.url;
        if (!url) {
          throw new Error("Share link was not returned by the server");
        }
        setShareUrl(url);
      }

      const copied = await copyTextToClipboard(url);
      setCopiedShare(copied);
      setMessage(
        copied
          ? "Share link copied to clipboard."
          : "Share link ready — copy it from the box below."
      );
      setTimeout(() => setCopiedShare(false), 2500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setSharing(false);
    }
  }

  async function handleSyncAirbnbPrices() {
    if (readOnly || syncingPrices || busy) return;
    setSyncingPrices(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hotel/${hotelId}/calendar/sync-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: 3, sampleEvery: 2 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to sync Airbnb prices");
      const updated = (json.rooms || []).filter(
        (room: { updatedDays: number }) => room.updatedDays > 0
      ).length;
      setMessage(
        json.summary ||
          `Synced Airbnb prices for ${updated} room${updated === 1 ? "" : "s"}.`
      );
      await loadCalendar();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to sync Airbnb prices");
    } finally {
      setSyncingPrices(false);
    }
  }

  async function toggleBlock(roomId: string, day: string, cell: CalendarCell) {
    if (readOnly || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (cell.status === "manual_block" && cell.blockId) {
        const res = await fetch(
          `/api/admin/hotel/${hotelId}/calendar/blocks?blockId=${cell.blockId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to unblock");
        }
        setMessage("Dates unblocked.");
      } else if (cell.status === "available") {
        const res = await fetch(`/api/admin/hotel/${hotelId}/calendar/blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: roomId, startDate: day }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to block");
        }
        setMessage("Date blocked.");
      } else {
        return;
      }
      setSelected(null);
      await loadCalendar();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDailyPrice(roomId: string, day: string) {
    if (readOnly || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const pesos = priceInput.trim();
      const res = await fetch(`/api/admin/hotel/${hotelId}/calendar/prices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: roomId,
          date: day,
          priceCents: pesos === "" ? null : Math.round(Number(pesos) * 100),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update price");
      setMessage("Price updated.");
      setSelected(null);
      await loadCalendar();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update price");
    } finally {
      setBusy(false);
    }
  }

  async function saveBasePrice(roomId: string) {
    if (readOnly || busy) return;
    const pesos = basePriceDrafts[roomId];
    if (!pesos) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hotel/${hotelId}/calendar/prices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: roomId,
          nightlyBasePrice: Math.round(Number(pesos) * 100),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update base price");
      setMessage("Base price updated.");
      await loadCalendar();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update base price");
    } finally {
      setBusy(false);
    }
  }

  async function cancelBooking(bookingId: string) {
    if (readOnly || busy) return;
    if (!confirm("Cancel this reservation?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/hotel/${hotelId}/calendar/bookings/${bookingId}/cancel`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to cancel booking");
      setMessage("Booking canceled.");
      setSelected(null);
      await loadCalendar();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="rounded border bg-white p-6 text-gray-600">Loading calendar…</div>;
  }

  if (error || !data) {
    return <div className="rounded border bg-red-50 p-6 text-red-700">{error || "No data"}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Multi Calendar</h2>
          <p className="text-sm text-gray-600">
            {data.startDate} → {data.endDate} ({data.days.length} nights shown)
          </p>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSyncAirbnbPrices}
              disabled={syncingPrices || busy}
              className="rounded border border-[#00a19c] bg-white px-4 py-2 text-sm text-[#008a86] hover:bg-[#e8f6f5] disabled:opacity-50"
            >
              {syncingPrices ? "Syncing Airbnb prices…" : "Sync prices from Airbnb"}
            </button>
            <button
              type="button"
              onClick={handleShareLink}
              disabled={sharing}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {sharing
                ? "Creating link…"
                : copiedShare
                  ? "Copied!"
                  : shareUrl
                    ? "Copy share link"
                    : "Share calendar link"}
            </button>
          </div>
        ) : null}
      </div>

      {!readOnly && (shareUrl || message) ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
          {shareUrl ? (
            <>
              <p className="text-sm font-medium text-gray-800">Shared calendar link</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                  onFocus={(event) => event.target.select()}
                />
                <button
                  type="button"
                  onClick={() => void handleShareLink()}
                  disabled={sharing}
                  className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-white disabled:opacity-50"
                >
                  Copy link
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Anyone with this link can view the next 3 months read-only. Refresh the page to
                see new bookings or blocks.
              </p>
            </>
          ) : null}
          {message ? (
            <div
              className={`rounded px-3 py-2 text-sm ${
                message.includes("Failed") || message.includes("Invalid")
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {message}
            </div>
          ) : null}
        </div>
      ) : null}

      {!readOnly ? (
        <p className="text-sm text-gray-600">
          Click an available day to block it, a blocked day to unblock it, or a booking to cancel
          it. Select a day below to set a custom nightly price. Use{" "}
          <span className="font-medium">Sync prices from Airbnb</span> to pull live nightly rates
          into this calendar (rooms need an Airbnb URL or iCal link).
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-white border" /> Available</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-slate-300" /> Blocked</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-rose-200" /> Booked</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-amber-200" /> Processing</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-violet-200" /> External</span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-max border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[180px] border-b border-r bg-gray-50 px-3 py-2 text-left">
                Room
              </th>
              {monthGroups.map((group) => (
                <th
                  key={group.label}
                  colSpan={group.days.length}
                  className="border-b bg-gray-50 px-2 py-2 text-center font-medium text-gray-700"
                >
                  {group.label}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 border-b border-r bg-gray-50 px-3 py-2 text-left">
                Base price
              </th>
              {data.days.map((day) => (
                <th
                  key={day}
                  className="border-b px-1 py-2 text-center font-normal text-gray-500"
                >
                  {new Date(`${day}T00:00:00`).getDate()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rooms.map((room) => {
              const segments = buildRowSegments(
                data.days,
                room.cells,
                room.spans || []
              );
              return (
              <tr key={room.id}>
                <td className="sticky left-0 z-10 border-r bg-gray-50 px-3 py-3 align-top">
                  <div className="font-medium text-gray-900">{room.title}</div>
                  {!readOnly ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={basePriceDrafts[room.id] ?? ""}
                        onChange={(event) =>
                          setBasePriceDrafts((current) => ({
                            ...current,
                            [room.id]: event.target.value,
                          }))
                        }
                        className="w-20 rounded border px-2 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => saveBasePrice(room.id)}
                        className="rounded border px-2 py-1 hover:bg-white"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 text-gray-600">
                      {formatMoneyShort(room.nightlyBasePrice, room.baseCurrency)}
                    </div>
                  )}
                </td>
                {segments.map((segment) => {
                  if (segment.type === "span") {
                    const { span } = segment;
                    const firstDay = segment.days[0];
                    const firstCell = room.cells[firstDay];
                    const isSelected =
                      selected?.roomId === room.id &&
                      segment.days.includes(selected.day);
                    const title = spanTitle(span);
                    return (
                      <td
                        key={`${room.id}-${span.id}`}
                        colSpan={segment.days.length}
                        className="border-b border-r p-0.5 align-middle"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelected({
                              roomId: room.id,
                              roomTitle: room.title,
                              day: firstDay,
                              cell: firstCell,
                            });
                            if (!readOnly && span.kind === "booking") {
                              setPriceInput(
                                String(Math.round(firstCell.priceCents / 100))
                              );
                            }
                          }}
                          className={[
                            "flex h-12 w-full items-center gap-2 overflow-hidden rounded-full px-3 text-left text-[11px] font-medium shadow-sm transition",
                            spanBarClass(span),
                            isSelected ? "ring-2 ring-[#00a19c] ring-offset-1" : "",
                            "cursor-pointer hover:brightness-95",
                          ].join(" ")}
                          title={title}
                        >
                          <span className="truncate">{span.guestName || span.label}</span>
                          {span.guestCount != null && span.guestCount > 0 ? (
                            <span className="shrink-0 opacity-90">
                              · {span.guestCount}{" "}
                              {span.guestCount === 1 ? "guest" : "guests"}
                            </span>
                          ) : null}
                        </button>
                      </td>
                    );
                  }

                  const { day, cell } = segment;
                  const isSelected =
                    selected?.roomId === room.id && selected?.day === day;
                  return (
                    <td key={`${room.id}-${day}`} className="border-b border-r p-0">
                      <button
                        type="button"
                        disabled={readOnly && cell.status === "available"}
                        onClick={() => {
                          if (readOnly) {
                            setSelected({ roomId: room.id, roomTitle: room.title, day, cell });
                            return;
                          }
                          if (cell.status === "available" || cell.status === "manual_block") {
                            toggleBlock(room.id, day, cell);
                            return;
                          }
                          setSelected({ roomId: room.id, roomTitle: room.title, day, cell });
                          setPriceInput(String(Math.round(cell.priceCents / 100)));
                        }}
                        className={[
                          "flex h-14 w-14 flex-col items-center justify-center border transition",
                          cellClass(cell),
                          isSelected ? "ring-2 ring-[#00a19c]" : "",
                          readOnly ? "cursor-default" : "cursor-pointer",
                        ].join(" ")}
                        title={cell.label}
                      >
                        <span className="text-[10px]">
                          {formatMoneyShort(cell.priceCents, room.baseCurrency)}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
          <div className="text-sm">
            <span className="font-medium">{selected.roomTitle}</span> · {selected.day} ·{" "}
            {selected.cell.label}
          </div>
          {selected.cell.guestName || selected.cell.guestEmail ? (
            <div className="text-sm text-gray-700">
              Guest: {selected.cell.guestName || selected.cell.guestEmail}
              {selected.cell.guestCount != null
                ? ` · ${selected.cell.guestCount} guest${selected.cell.guestCount === 1 ? "" : "s"}`
                : ""}
              {selected.cell.guestPhone ? ` · ${selected.cell.guestPhone}` : ""}
            </div>
          ) : null}
          {!readOnly && selected.cell.status === "booking" && selected.cell.bookingId ? (
            <button
              type="button"
              onClick={() => cancelBooking(selected.cell.bookingId!)}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              Cancel reservation
            </button>
          ) : null}
          {!readOnly && selected.cell.status !== "external" ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nightly price (MXN)
                </label>
                <input
                  type="number"
                  min="0"
                  value={priceInput}
                  onChange={(event) => setPriceInput(event.target.value)}
                  className="rounded border px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => saveDailyPrice(selected.roomId, selected.day)}
                className="rounded bg-[#00a19c] px-4 py-2 text-sm text-white"
              >
                Save day price
              </button>
              <button
                type="button"
                onClick={() => {
                  setPriceInput("");
                  saveDailyPrice(selected.roomId, selected.day);
                }}
                className="rounded border px-4 py-2 text-sm"
              >
                Reset to base
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
