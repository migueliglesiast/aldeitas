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
  span?: CalendarSpan;
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
  const name =
    span.guestName && !/^airbnb guest$/i.test(span.guestName)
      ? span.guestName
      : span.kind === "external"
        ? "Airbnb guest"
        : span.guestName || span.label;
  if (span.guestCount != null && span.guestCount > 0) {
    return `${name} · ${span.guestCount} guest${span.guestCount === 1 ? "" : "s"}`;
  }
  return name;
}

function spanGuestLabel(span: CalendarSpan, compact = false) {
  const name =
    span.guestName && !/^airbnb guest$/i.test(span.guestName)
      ? span.guestName
      : span.kind === "external"
        ? "Airbnb guest"
        : span.guestName || span.label;
  const count =
    span.guestCount != null && span.guestCount > 0 ? span.guestCount : null;
  // Short spans / phone: keep count compact so the name can truncate inside the bubble.
  const countText =
    count == null
      ? null
      : compact || span.dayCount <= 2
        ? `· ${count}`
        : `· ${count} guest${count === 1 ? "" : "s"}`;
  return { name, countText };
}

function useCompactCalendarLayout() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const apply = () => setCompact(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return compact;
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
  const [guestNameInput, setGuestNameInput] = useState("");
  const [guestCountInput, setGuestCountInput] = useState("");
  const [basePriceDrafts, setBasePriceDrafts] = useState<Record<string, string>>({});
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [busy, setBusy] = useState(false);
  const compact = useCompactCalendarLayout();
  // Share / phone: tighter columns so more nights fit on screen.
  const phoneShare = Boolean(shareToken || readOnly) && compact;
  const roomColWidth = phoneShare ? 76 : compact ? 100 : 180;
  const dayColWidth = phoneShare ? 32 : compact ? 40 : 56;

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

  // Automatically fill missing guest names in the background (admin calendar only).
  // Throttled server-side (~12 min) so opening the calendar does not hammer Gmail.
  useEffect(() => {
    if (readOnly || shareToken || !hotelId) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/admin/hotel/${hotelId}/gmail-sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "sync",
              restart: true,
              background: true,
            }),
          });
          if (!res.ok || cancelled) return;
          const json = await res.json().catch(() => ({}));
          if (!cancelled && Number(json.updated) > 0) {
            await loadCalendar();
          }
        } catch {
          // Silent — manual fill button remains available under Maintenance.
        }
      })();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hotelId, readOnly, shareToken, loadCalendar]);

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

  async function saveGuestDetails() {
    if (readOnly || busy || !selected) return;
    if (selected.cell.status !== "booking" && selected.cell.status !== "external") {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const span = selected.span;
      const checkoutDay =
        span?.checkoutDay ||
        (() => {
          const d = new Date(`${selected.day}T00:00:00`);
          d.setDate(d.getDate() + 1);
          return d.toISOString().slice(0, 10);
        })();
      const startDay = span?.rangeStartDay || span?.startDay || selected.day;
      const res = await fetch(`/api/admin/hotel/${hotelId}/calendar/guest-meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: selected.roomId,
          startDate: startDay,
          endDate: checkoutDay,
          guestName: guestNameInput.trim() || null,
          guestCount: guestCountInput.trim()
            ? Number(guestCountInput)
            : null,
          bookingId: selected.cell.bookingId,
          sourceUid: span?.sourceUid,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save guest details");
      setMessage("Guest details saved.");
      await loadCalendar();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save guest details");
    } finally {
      setBusy(false);
    }
  }

  function selectCell(args: {
    roomId: string;
    roomTitle: string;
    day: string;
    cell: CalendarCell;
    span?: CalendarSpan;
  }) {
    setSelected(args);
    setGuestNameInput(args.span?.guestName || args.cell.guestName || "");
    setGuestCountInput(
      args.span?.guestCount != null
        ? String(args.span.guestCount)
        : args.cell.guestCount != null
          ? String(args.cell.guestCount)
          : ""
    );
    if (args.cell.status === "booking" || args.cell.status === "available") {
      setPriceInput(String(Math.round(args.cell.priceCents / 100)));
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
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className={`font-semibold ${shareToken ? "text-base sm:text-xl" : "text-xl"}`}>
            {shareToken ? "Availability" : "Multi Calendar"}
          </h2>
          <p className="text-xs text-gray-600 sm:text-sm">
            {data.startDate} → {data.endDate}
            <span className="hidden sm:inline">
              {" "}
              ({data.days.length} nights shown)
            </span>
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

      <div
        className={`flex flex-wrap gap-x-3 gap-y-1 text-[10px] sm:gap-3 sm:text-xs ${
          shareToken ? "text-gray-600" : ""
        }`}
      >
        <span className="inline-flex items-center gap-1.5 sm:gap-2">
          <span className="h-2.5 w-2.5 rounded border bg-white sm:h-3 sm:w-3" /> Available
        </span>
        <span className="inline-flex items-center gap-1.5 sm:gap-2">
          <span className="h-2.5 w-2.5 rounded bg-slate-300 sm:h-3 sm:w-3" /> Blocked
        </span>
        <span className="inline-flex items-center gap-1.5 sm:gap-2">
          <span className="h-2.5 w-2.5 rounded bg-rose-200 sm:h-3 sm:w-3" /> Booked
        </span>
        {!shareToken ? (
          <span className="inline-flex items-center gap-1.5 sm:gap-2">
            <span className="h-2.5 w-2.5 rounded bg-amber-200 sm:h-3 sm:w-3" /> Processing
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 sm:gap-2">
          <span className="h-2.5 w-2.5 rounded bg-violet-200 sm:h-3 sm:w-3" /> External
        </span>
      </div>

      <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-lg border bg-white sm:mx-0">
        <table
          className="border-collapse text-[10px] sm:text-xs"
          style={{
            tableLayout: "fixed",
            width: roomColWidth + data.days.length * dayColWidth,
          }}
        >
          <colgroup>
            <col style={{ width: roomColWidth }} />
            {data.days.map((day) => (
              <col key={`col-${day}`} style={{ width: dayColWidth }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 border-b border-r bg-gray-50 px-1.5 py-1.5 text-left sm:px-3 sm:py-2"
                style={{
                  width: roomColWidth,
                  minWidth: roomColWidth,
                  maxWidth: roomColWidth,
                }}
              >
                Room
              </th>
              {monthGroups.map((group) => (
                <th
                  key={group.label}
                  colSpan={group.days.length}
                  className="border-b bg-gray-50 px-0.5 py-1.5 text-center text-[10px] font-medium text-gray-700 sm:px-2 sm:py-2 sm:text-xs"
                >
                  {phoneShare
                    ? group.label.replace(/(\w+)\s+(\d{4})/, (_, m, y) => `${m.slice(0, 3)} ${y}`)
                    : group.label}
                </th>
              ))}
            </tr>
            <tr>
              <th
                className="sticky left-0 z-20 border-b border-r bg-gray-50 px-1.5 py-1 text-left text-[10px] text-gray-500 sm:px-3 sm:py-2 sm:text-xs"
                style={{
                  width: roomColWidth,
                  minWidth: roomColWidth,
                  maxWidth: roomColWidth,
                }}
              >
                {phoneShare ? "" : "Base price"}
              </th>
              {data.days.map((day) => (
                <th
                  key={day}
                  className="border-b px-0 py-1 text-center font-normal text-gray-500 sm:py-2"
                  style={{
                    width: dayColWidth,
                    minWidth: dayColWidth,
                    maxWidth: dayColWidth,
                  }}
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
                <td
                  className="sticky left-0 z-10 border-r bg-gray-50 px-1.5 py-2 align-top sm:px-3 sm:py-3"
                  style={{
                    width: roomColWidth,
                    minWidth: roomColWidth,
                    maxWidth: roomColWidth,
                  }}
                >
                  <div
                    className={`font-medium leading-tight text-gray-900 ${
                      phoneShare ? "line-clamp-2 text-[10px]" : "text-xs sm:text-sm"
                    }`}
                  >
                    {room.title}
                  </div>
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
                  ) : phoneShare ? null : (
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
                    const { name, countText } = spanGuestLabel(span, phoneShare);
                    const spanWidthPx = segment.days.length * dayColWidth;
                    return (
                      <td
                        key={`${room.id}-${span.id}`}
                        colSpan={segment.days.length}
                        className="border-b border-r p-px align-middle sm:p-0.5"
                        style={{
                          width: spanWidthPx,
                          maxWidth: spanWidthPx,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            selectCell({
                              roomId: room.id,
                              roomTitle: room.title,
                              day: firstDay,
                              cell: firstCell,
                              span,
                            });
                          }}
                          className={[
                            "flex w-full min-w-0 max-w-full items-center gap-0.5 overflow-hidden rounded-full text-left font-medium shadow-sm transition sm:gap-1",
                            phoneShare
                              ? "h-8 px-1 text-[9px] leading-tight"
                              : "h-12 px-2 text-[11px]",
                            spanBarClass(span),
                            isSelected ? "ring-2 ring-[#00a19c] ring-offset-1" : "",
                            "cursor-pointer hover:brightness-95",
                          ].join(" ")}
                          title={title}
                        >
                          <span className="min-w-0 flex-1 truncate">{name}</span>
                          {countText ? (
                            <span className="shrink-0 whitespace-nowrap opacity-90">
                              {countText}
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
                    <td
                      key={`${room.id}-${day}`}
                      className="border-b border-r p-0"
                      style={{
                        width: dayColWidth,
                        minWidth: dayColWidth,
                        maxWidth: dayColWidth,
                      }}
                    >
                      <button
                        type="button"
                        disabled={readOnly && cell.status === "available"}
                        onClick={() => {
                          if (
                            !readOnly &&
                            (cell.status === "available" || cell.status === "manual_block")
                          ) {
                            toggleBlock(room.id, day, cell);
                            return;
                          }
                          selectCell({
                            roomId: room.id,
                            roomTitle: room.title,
                            day,
                            cell,
                          });
                        }}
                        className={[
                          "flex flex-col items-center justify-center border transition",
                          phoneShare ? "h-8 w-full" : "h-14 w-14",
                          cellClass(cell),
                          isSelected ? "ring-2 ring-[#00a19c]" : "",
                          readOnly ? "cursor-default" : "cursor-pointer",
                        ].join(" ")}
                        style={
                          phoneShare
                            ? { width: dayColWidth, height: 32 }
                            : undefined
                        }
                        title={cell.label}
                      >
                        {!phoneShare || cell.status === "available" ? (
                          <span
                            className={
                              phoneShare ? "text-[7px] leading-none text-gray-500" : "text-[10px]"
                            }
                          >
                            {phoneShare
                              ? ""
                              : formatMoneyShort(cell.priceCents, room.baseCurrency)}
                          </span>
                        ) : null}
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
        <div className="rounded-lg border bg-gray-50 p-3 space-y-3 sm:p-4">
          <div className="text-sm">
            <span className="font-medium">{selected.roomTitle}</span> · {selected.day} ·{" "}
            {selected.cell.label}
          </div>
          {(selected.cell.status === "booking" ||
            selected.cell.status === "external") && (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                {selected.span
                  ? spanTitle(selected.span)
                  : selected.cell.guestName || "Guest"}
                {selected.cell.guestPhone ? ` · ${selected.cell.guestPhone}` : ""}
                {selected.cell.guestEmail ? ` · ${selected.cell.guestEmail}` : ""}
                {selected.span?.payoutCents != null ? (
                  <div className="mt-1 text-gray-600">
                    Payout:{" "}
                    {(selected.span.payoutCents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: selected.span.payoutCurrency || "MXN",
                    })}
                  </div>
                ) : null}
              </div>
              {!readOnly ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Guest name
                    </label>
                    <input
                      type="text"
                      value={guestNameInput}
                      onChange={(event) => setGuestNameInput(event.target.value)}
                      className="rounded border px-3 py-2 text-sm"
                      placeholder="e.g. Juan Pablo"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Number of guests
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={guestCountInput}
                      onChange={(event) => setGuestCountInput(event.target.value)}
                      className="w-28 rounded border px-3 py-2 text-sm"
                      placeholder="e.g. 2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveGuestDetails()}
                    className="rounded bg-[#00a19c] px-4 py-2 text-sm text-white"
                  >
                    Save guest details
                  </button>
                </div>
              ) : null}
              {selected.cell.status === "external" && !readOnly ? (
                <p className="text-xs text-gray-500">
                  Airbnb calendar export does not include guest name or guest count. Enter them
                  here once and they will show on the bar.
                </p>
              ) : null}
            </div>
          )}
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
