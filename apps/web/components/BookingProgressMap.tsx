"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/currency";

type ProgressEvent = { step: string; status: string; detail: string | null; createdAt: string };

type ProgressBooking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELED";
  guestEmail: string;
  guestName: string | null;
  startDate: string;
  endDate: string;
  totalPriceCents: number;
  currency: string;
  paymentOrderId: string | null;
  createdAt: string;
  authorizedAt: string | null;
  confirmedAt: string | null;
  pendingExpiresAt: string | null;
  lastReconciledAt: string | null;
  cancelReason: string | null;
  listing: { title: string; hotelName: string };
  addons: { name: string; quantity: number; option: string | null }[];
};

type StepState = "done" | "failed" | "active" | "waiting" | "skipped";

type MapStep = { key: string; es: string; en: string; state: StepState; at?: string; detail?: string | null };

const POLL_MS = 3000;

function last(events: ProgressEvent[], ...steps: string[]) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (steps.includes(events[i].step)) return events[i];
  }
  return undefined;
}

function fromEvent(event: ProgressEvent | undefined, fallback: StepState): Pick<MapStep, "state" | "at" | "detail"> {
  if (!event) return { state: fallback };
  return { state: event.status === "fail" ? "failed" : "done", at: event.createdAt, detail: event.detail };
}

export function buildProgressSteps(booking: ProgressBooking, events: ProgressEvent[]): MapStep[] {
  const canceled = booking.status === "CANCELED";
  const confirmed = booking.status === "CONFIRMED";
  const charged = last(events, "payment_charged");
  const held = last(events, "payment_held");
  const paymentFailed = last(events, "payment_failed");
  const submitted = last(events, "payment_submitted");
  const paid = Boolean(booking.authorizedAt || charged || held);
  const isDebit = Boolean(charged);
  const ended = canceled || confirmed;
  const next = (ready: boolean): StepState => (ended ? "skipped" : ready ? "active" : "waiting");

  const created = last(events, "created");
  const steps: MapStep[] = [
    {
      key: "created",
      es: "Reserva creada",
      en: "Booking created",
      ...fromEvent(created, "done"),
      at: created?.createdAt ?? booking.createdAt,
    },
    {
      key: "availability_initial",
      es: "Fechas libres al reservar",
      en: "Dates free at checkout",
      ...fromEvent(last(events, "availability_initial"), "done"),
    },
  ];

  const paymentEvent = charged ?? held ?? paymentFailed;
  steps.push({
    key: "payment",
    es: isDebit ? "Pago cobrado (débito)" : "Pago en espera (tarjeta retenida)",
    en: isDebit ? "Payment charged (debit)" : "Payment on hold (card authorized)",
    ...(paymentEvent
      ? fromEvent(paid ? (charged ?? held) : paymentFailed, "done")
      : booking.authorizedAt
        ? { state: "done" as const, at: booking.authorizedAt }
        : { state: canceled ? ("skipped" as const) : submitted ? ("active" as const) : ("waiting" as const) }),
    ...(paymentFailed && !paid ? { state: canceled ? ("failed" as const) : ("active" as const) } : {}),
    detail: paid ? (charged ?? held)?.detail ?? null : paymentFailed?.detail ?? submitted?.detail ?? "Esperando la tarjeta del huésped / Waiting for the guest's card",
  });

  const availability = last(events, "availability_check");
  steps.push({
    key: "availability_check",
    es: "Verificación de calendarios (Airbnb, Booking, Vrbo)",
    en: "Calendar check (Airbnb, Booking, Vrbo)",
    ...fromEvent(availability, next(paid)),
    ...(availability || !booking.lastReconciledAt ? {} : { state: "done" as const, at: booking.lastReconciledAt }),
  });

  const blocked = last(events, "dates_blocked");
  const synced = last(events, "channel_synced");
  steps.push({
    key: "dates_blocked",
    es: "Fechas bloqueadas",
    en: "Dates blocked",
    ...fromEvent(blocked, paid && !canceled ? "done" : next(paid)),
    detail: [blocked?.detail, synced?.detail].filter(Boolean).join(" · ") || (paid && !canceled ? "Aldeitas iCal" : null),
  });

  if (!isDebit) {
    steps.push({
      key: "email_processing",
      es: "Correo «solicitud recibida»",
      en: "“Request received” email",
      ...fromEvent(last(events, "email_processing"), next(paid)),
    });
  }

  const captured = last(events, "payment_captured");
  const released = last(events, "payment_released");
  steps.push(
    canceled
      ? {
          key: "payment_final",
          es: "Retención liberada (sin cargo)",
          en: "Hold released (no charge)",
          ...fromEvent(released, paid ? "done" : "skipped"),
        }
      : {
          key: "payment_final",
          es: "Pago procesado",
          en: "Payment processed",
          ...fromEvent(captured, confirmed ? "done" : next(paid)),
          ...(captured || !booking.confirmedAt ? {} : { at: booking.confirmedAt }),
        }
  );

  const outcome = last(events, "confirmed", "canceled");
  steps.push(
    canceled
      ? {
          key: "outcome",
          es: "Reserva cancelada",
          en: "Booking canceled",
          state: "failed",
          at: outcome?.createdAt,
          detail: booking.cancelReason,
        }
      : {
          key: "outcome",
          es: "Reserva confirmada",
          en: "Booking confirmed",
          ...fromEvent(outcome, confirmed ? "done" : next(paid)),
          ...(outcome || !booking.confirmedAt ? {} : { at: booking.confirmedAt }),
        }
  );

  const finalEmail = last(events, canceled ? "email_canceled" : "email_confirmed");
  steps.push({
    key: "email_final",
    es: canceled ? "Correo de cancelación" : "Correo de confirmación",
    en: canceled ? "Cancellation email" : "Confirmation email",
    ...fromEvent(finalEmail, ended ? "done" : "waiting"),
    ...(finalEmail || !ended ? {} : { detail: "Enviado antes de que existiera este registro / Sent before this log existed" }),
  });

  return steps;
}

const DOT: Record<StepState, string> = {
  done: "bg-emerald-500 text-white",
  failed: "bg-red-500 text-white",
  active: "bg-amber-400 text-white animate-pulse",
  waiting: "bg-gray-200 text-gray-500",
  skipped: "bg-gray-100 text-gray-300",
};

const ICON: Record<StepState, string> = { done: "✓", failed: "✕", active: "…", waiting: "", skipped: "–" };

function time(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function BookingProgressMap({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<{ booking: ProgressBooking; events: ProgressEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/progress`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load");
      setData(json);
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [bookingId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">Cargando… / Loading…</p>;

  const { booking, events } = data;
  const steps = buildProgressSteps(booking, events);
  const live = booking.status === "PENDING";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{booking.listing.hotelName}</p>
            <h1 className="text-xl font-semibold text-gray-900">{booking.listing.title}</h1>
            <p className="text-sm text-gray-600">
              {booking.startDate.slice(0, 10)} → {booking.endDate.slice(0, 10)} · {booking.guestName || booking.guestEmail}
            </p>
            <p className="text-sm font-semibold text-gray-900">{formatMoney(booking.totalPriceCents, booking.currency)}</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${
                live ? "bg-amber-100 text-amber-900" : booking.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
              }`}
            >
              {live && <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />}
              {live ? "En proceso / In progress" : booking.status === "CONFIRMED" ? "Confirmada / Confirmed" : "Cancelada / Canceled"}
            </span>
            <p className="mt-2">Actualizado / Updated {updatedAt ? time(updatedAt.toISOString()) : ""}</p>
            {live && booking.pendingExpiresAt && <p>Vence / Expires {time(booking.pendingExpiresAt)}</p>}
          </div>
        </div>
      </div>

      <ol className="relative space-y-0" aria-label="Booking progress">
        {steps.map((step, index) => (
          <li key={step.key} className="relative flex gap-4 pb-6" data-state={step.state}>
            {index < steps.length - 1 && (
              <span className={`absolute left-4 top-8 h-full w-0.5 ${step.state === "done" ? "bg-emerald-300" : "bg-gray-200"}`} />
            )}
            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${DOT[step.state]}`}>
              {ICON[step.state] || index + 1}
            </span>
            <div className="min-w-0 pt-1">
              <p className={`font-semibold ${step.state === "skipped" || step.state === "waiting" ? "text-gray-400" : "text-gray-900"}`}>
                {step.es} <span className="font-normal text-gray-400">/ {step.en}</span>
              </p>
              {step.at && <p className="text-xs text-gray-500">{time(step.at)}</p>}
              {step.detail && <p className="mt-0.5 break-words text-sm text-gray-600">{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>

      {booking.addons.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
          <p className="mb-1 font-semibold">Extras</p>
          <ul className="list-inside list-disc text-gray-700">
            {booking.addons.map((addon, i) => (
              <li key={i}>
                {addon.quantity} × {addon.name}
                {addon.option ? ` (${addon.option})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Registro completo / Full log ({events.length})</summary>
        <ul className="mt-3 space-y-1 font-mono text-xs text-gray-700">
          {events.map((event, i) => (
            <li key={i}>
              {time(event.createdAt)} · {event.step} · {event.status}
              {event.detail ? ` · ${event.detail}` : ""}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
