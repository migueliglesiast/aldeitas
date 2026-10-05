"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Props = {
  slug: string;
  hotelName: string;
};

export default function CalendarPinForm({ slug, hotelName }: Props) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || pin.length < 4) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/${encodeURIComponent(slug)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (json.error === "locked") {
        const minutes = Math.max(1, Math.ceil((json.retryAfterSeconds ?? 900) / 60));
        setError(`Demasiados intentos. Intenta de nuevo en ${minutes} min.`);
      } else {
        setError("PIN incorrecto.");
      }
      setPin("");
    } catch {
      setError("No se pudo verificar el PIN. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center shadow-sm"
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-400 sm:text-xs">
          Calendario compartido
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">{hotelName}</h1>
        <label htmlFor="calendar-pin" className="mt-6 block text-sm text-gray-500">
          Ingresa el PIN para ver el calendario
        </label>
        <input
          id="calendar-pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={8}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-2xl tracking-[0.5em] text-gray-900 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "calendar-pin-error" : undefined}
        />
        {error ? (
          <p id="calendar-pin-error" role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting || pin.length < 4}
          className="mt-5 w-full rounded-lg bg-[#0f766e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0c5f59] disabled:opacity-50"
        >
          {submitting ? "Verificando…" : "Ver calendario"}
        </button>
        <p className="mt-4 text-xs text-gray-400">Se recordará en este dispositivo.</p>
      </form>
    </div>
  );
}
