"use client";

import { useState } from "react";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

/** Shares the staff calendar (/calendar/[token]): stays and cleaning tasks, no money. */
export default function ShareCleaningCalendarButton({ token, hotelName }: { token: string; hotelName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function share() {
    const link = `${window.location.origin}/calendar/${token}`;
    const text = `Calendario de limpieza y mantenimiento · ${hotelName}`;
    setUrl(link);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: text, text, url: link });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    const ok = await copyTextToClipboard(link);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2500);
  }

  const message = url ? `Calendario de limpieza y mantenimiento · ${hotelName}: ${url}` : null;
  const whatsapp = message ? "https://wa.me/?text=" + encodeURIComponent(message) : null;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex items-center gap-2 rounded-full bg-[#00a19c] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#008a86]"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M10 13V3M6 7l4-4 4 4M4 11v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5" />
        </svg>
        {copied ? "¡Enlace copiado!" : "Compartir calendario de limpieza"}
      </button>
      {url ? (
        <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={url}
            aria-label="Enlace del calendario de limpieza"
            onFocus={(e) => e.target.select()}
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700"
          />
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
              WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-gray-400">Para limpieza y mantenimiento: estancias y tareas, sin precios.</p>
    </div>
  );
}
