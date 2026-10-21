"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  ADDON_UNITS,
  ADDON_UNIT_LABELS,
  type AddonUnit,
} from "@/lib/addon-units";

type Addon = {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  emoji: string | null;
  priceCents: number;
  currency: string;
  unit: AddonUnit;
  maxQuantity: number;
  stock: number | null;
  nightPercent: number | null;
  enabled: boolean;
};

type Draft = Omit<Addon, "id" | "currency">;

const EMPTY: Draft = {
  name: "",
  nameEn: null,
  description: null,
  emoji: "✨",
  priceCents: 0,
  unit: "item",
  maxQuantity: 10,
  stock: null,
  nightPercent: null,
  enabled: true,
};

const COPY = {
  es: {
    title: "Extras para huéspedes",
    intro:
      "Lo que tus huéspedes pueden agregar al reservar. Se cobra junto con la estancia y te llega en el correo de la reserva.",
    price: "Precio (MXN)",
    percent: "% de la noche",
    percentHint: "vacío = precio fijo",
    ofNight: "de la noche",
    unit: "Cobro",
    max: "Máx. por reserva",
    stock: "Disponibles a la vez",
    stockHint: "vacío = sin límite",
    on: "Visible",
    off: "Oculto",
    save: "Guardar",
    saved: "Guardado",
    remove: "Eliminar",
    add: "+ Agregar extra",
    name: "Nombre",
    nameEn: "Nombre en inglés",
    description: "Descripción corta",
    needsPrice: "Ponle precio para mostrarlo",
    edit: "Editar",
    close: "Cerrar",
    units: "disponibles",
    ideas: "Más ideas (apagadas)",
    newTitle: "Crear uno nuevo",
  },
  en: {
    title: "Guest add-ons",
    intro:
      "Extras guests can add when booking. Charged with the stay and listed in the booking email.",
    price: "Price (MXN)",
    percent: "% of nightly rate",
    percentHint: "empty = fixed price",
    ofNight: "of the nightly rate",
    unit: "Charge",
    max: "Max per booking",
    stock: "Available at once",
    stockHint: "empty = unlimited",
    on: "Visible",
    off: "Hidden",
    save: "Save",
    saved: "Saved",
    remove: "Delete",
    add: "+ Add an add-on",
    name: "Name",
    nameEn: "English name",
    description: "Short description",
    needsPrice: "Set a price to show it",
    edit: "Edit",
    close: "Close",
    units: "available",
    ideas: "More ideas (off)",
    newTitle: "Create a new one",
  },
};

function AddonRow({
  hotelId,
  addon,
  lang,
  onSaved,
  onRemoved,
}: {
  hotelId: string;
  addon: Addon | null;
  lang: "es" | "en";
  onSaved: (addon: Addon) => void;
  onRemoved: (id: string) => void;
}) {
  const t = COPY[lang];
  const [draft, setDraft] = useState<Draft>(addon ?? EMPTY);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [open, setOpen] = useState(addon === null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  };

  async function save() {
    setStatus("saving");
    const res = await fetch(
      addon
        ? `/api/admin/hotel/${hotelId}/addons/${addon.id}`
        : `/api/admin/hotel/${hotelId}/addons`,
      {
        method: addon ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      },
    );
    if (!res.ok) return setStatus("error");
    const data: { addon: Addon } = await res.json();
    onSaved(data.addon);
    setStatus("saved");
    if (!addon) setDraft(EMPTY);
  }

  async function toggle(enabled: boolean) {
    set("enabled", enabled);
    if (!addon) return;
    const res = await fetch(`/api/admin/hotel/${hotelId}/addons/${addon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) return setStatus("error");
    const data: { addon: Addon } = await res.json();
    onSaved(data.addon);
  }

  async function remove() {
    if (!addon) return;
    const res = await fetch(`/api/admin/hotel/${hotelId}/addons/${addon.id}`, {
      method: "DELETE",
    });
    if (!res.ok) return setStatus("error");
    const data: { deleted?: boolean; addon?: Addon } = await res.json();
    if (data.addon) onSaved(data.addon);
    else onRemoved(addon.id);
  }

  const input =
    "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none";
  const label =
    "block text-[11px] font-semibold uppercase tracking-wide text-gray-500";

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${draft.enabled ? "border-gray-200 bg-white" : "border-dashed border-gray-300 bg-gray-50"}`}
    >
      {addon && (
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden>
            {draft.emoji || "✨"}
          </span>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="min-w-0 flex-1 text-left"
          >
            <span className="block truncate text-sm font-medium text-gray-900">
              {draft.name}
            </span>
            <span className="block text-xs text-gray-600">
              {draft.nightPercent
                ? `${draft.nightPercent}% ${t.ofNight}`
                : `$${(draft.priceCents / 100).toFixed(0)} ${ADDON_UNIT_LABELS[draft.unit][lang]}`}
              {draft.stock !== null ? ` · ${draft.stock} ${t.units}` : ""}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            {open ? t.close : t.edit}
          </button>
          <button
            type="button"
            aria-pressed={draft.enabled}
            onClick={() => toggle(!draft.enabled)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${draft.enabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}`}
          >
            {draft.enabled ? t.on : t.off}
          </button>
        </div>
      )}
      {open && (
        <>
          <div
            className={`flex flex-wrap items-start gap-3 ${addon ? "mt-3" : ""}`}
          >
            <input
              aria-label="Emoji"
              value={draft.emoji ?? ""}
              onChange={(e) => set("emoji", e.target.value || null)}
              className="w-12 rounded-lg border border-gray-300 py-1.5 text-center text-xl"
            />
            <div className="min-w-[180px] flex-1 space-y-2">
              <input
                aria-label={t.name}
                placeholder={t.name}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                className={`${input} font-medium`}
              />
              <input
                aria-label={t.nameEn}
                placeholder={t.nameEn}
                value={draft.nameEn ?? ""}
                onChange={(e) => set("nameEn", e.target.value || null)}
                className={input}
              />
              <input
                aria-label={t.description}
                placeholder={t.description}
                value={draft.description ?? ""}
                onChange={(e) => set("description", e.target.value || null)}
                className={input}
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <label className={label}>{t.price}</label>
              <input
                type="number"
                min={0}
                step={10}
                disabled={draft.nightPercent !== null}
                value={draft.priceCents / 100}
                onChange={(e) =>
                  set("priceCents", Math.round(Number(e.target.value) * 100))
                }
                className={`${input} disabled:bg-gray-100 disabled:text-gray-400`}
              />
            </div>
            <div>
              <label className={label}>{t.percent}</label>
              <input
                type="number"
                min={1}
                max={100}
                placeholder={t.percentHint}
                value={draft.nightPercent ?? ""}
                onChange={(e) =>
                  set("nightPercent", e.target.value === "" ? null : Math.round(Number(e.target.value)))
                }
                className={input}
              />
            </div>
            <div>
              <label className={label}>{t.unit}</label>
              <select
                value={draft.unit}
                onChange={(e) => set("unit", e.target.value as AddonUnit)}
                className={input}
              >
                {ADDON_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {ADDON_UNIT_LABELS[unit][lang]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>{t.max}</label>
              <input
                type="number"
                min={1}
                max={50}
                value={draft.maxQuantity}
                onChange={(e) =>
                  set("maxQuantity", Math.max(1, Number(e.target.value)))
                }
                className={input}
              />
            </div>
            <div>
              <label className={label}>{t.stock}</label>
              <input
                type="number"
                min={0}
                placeholder={t.stockHint}
                value={draft.stock ?? ""}
                onChange={(e) =>
                  set(
                    "stock",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className={input}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <button
              type="button"
              disabled={status === "saving" || !draft.name}
              onClick={save}
              className="rounded-lg bg-gray-900 px-4 py-1.5 font-medium text-white disabled:opacity-50"
            >
              {addon ? t.save : t.add}
            </button>
            {addon && (
              <button
                type="button"
                onClick={remove}
                className="text-gray-500 hover:text-red-700"
              >
                {t.remove}
              </button>
            )}
            {status === "saved" && (
              <span className="text-emerald-700">{t.saved}</span>
            )}
            {status === "error" && <span className="text-red-700">Error</span>}
            {draft.enabled && draft.priceCents === 0 && !draft.nightPercent && draft.name && (
              <span className="text-amber-700">{t.needsPrice}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AddonsPanel({ hotelId }: { hotelId: string }) {
  const { locale } = useLocale();
  const lang = locale === "en" ? "en" : "es";
  const t = COPY[lang];
  const [addons, setAddons] = useState<Addon[] | null>(null);

  useEffect(() => {
    fetch(`/api/admin/hotel/${hotelId}/addons`)
      .then((res) => (res.ok ? res.json() : { addons: [] }))
      .then((data: { addons: Addon[] }) => setAddons(data.addons));
  }, [hotelId]);

  const upsert = (addon: Addon) =>
    setAddons((prev) => {
      const list = prev ?? [];
      return list.some((item) => item.id === addon.id)
        ? list.map((item) => (item.id === addon.id ? addon : item))
        : [...list, addon];
    });

  const removeRow = (id: string) =>
    setAddons((prev) => (prev ?? []).filter((item) => item.id !== id));
  const renderRow = (addon: Addon) => (
    <AddonRow
      key={addon.id}
      hotelId={hotelId}
      addon={addon}
      lang={lang}
      onSaved={upsert}
      onRemoved={removeRow}
    />
  );

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white/80 p-6">
      <div>
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="text-sm text-gray-600">{t.intro}</p>
      </div>
      {addons === null ? (
        <p className="text-sm text-gray-400">…</p>
      ) : (
        <div className="space-y-2">
          {addons.filter((addon) => addon.enabled).map(renderRow)}
          {addons.some((addon) => !addon.enabled) && (
            <details className="group pt-2">
              <summary className="cursor-pointer text-sm font-medium text-gray-700">
                {t.ideas} · {addons.filter((addon) => !addon.enabled).length}
              </summary>
              <div className="mt-2 space-y-2">
                {addons.filter((addon) => !addon.enabled).map(renderRow)}
              </div>
            </details>
          )}
          <details className="pt-2">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              {t.newTitle}
            </summary>
            <div className="mt-2">
              <AddonRow
                hotelId={hotelId}
                addon={null}
                lang={lang}
                onSaved={upsert}
                onRemoved={() => undefined}
              />
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
