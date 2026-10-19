"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale-context";
import { onboardingText, type OnboardingCopyKey } from "@/lib/i18n/onboarding-copy";
import type { GmailListing } from "@/lib/gmail-listing-discovery";
import type { OnboardingRoom, OnboardingState } from "@/lib/onboarding";
import OnboardingDemo, { type DemoId } from "./OnboardingDemos";

export const OPEN_TOUR_EVENT = "aldeitas:open-tour";
const SEEN_KEY = "aldeitas-onboarding-seen";
const FULL_TOUR: DemoId[] = ["you", "story", "map", "inbox", "airbnb", "calendars", "team", "done"];
const LISTING_STEPS: ReadonlySet<DemoId> = new Set(["airbnb", "calendars"]);

type T = (key: OnboardingCopyKey, vars?: Record<string, string | number>) => string;

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-aldeitas focus:outline-none focus:ring-2 focus:ring-aldeitas/20";

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{text}</span>
      {children}
    </label>
  );
}

async function postJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

type StepProps = {
  t: T;
  state: OnboardingState;
  setState: (state: OnboardingState) => void;
  next: () => void;
  footer: (opts: FooterOpts) => ReactNode;
  importer: Importer;
  ensureNext: (id: DemoId) => void;
};

type FooterOpts = { busy: boolean; onSave: () => void; error: string | null; locked?: boolean };

type ImportItem = {
  airbnbId: string;
  roomId: string | null;
  title: string | null;
  cover: string | null;
  photoCount: number;
  created: boolean;
  status: "waiting" | "working" | "ok" | "linked" | "failed";
};

type ImportJob = { status: "idle" | "scanning" | "importing" | "done" | "error"; items: ImportItem[] };

type Importer = { job: ImportJob; start: () => void; reviewed: boolean; markReviewed: () => void };

const isRunning = (job: ImportJob) => job.status === "scanning" || job.status === "importing";

function importProgress(job: ImportJob) {
  const total = job.items.length;
  const done = job.items.filter((item) => item.status !== "waiting" && item.status !== "working").length;
  const ratio = job.status === "scanning" ? 0.08 : total ? Math.max(0.1, done / total) : 1;
  return { total, done, ratio };
}

function YouStep({ t, state, setState, next, footer }: StepProps) {
  const [nickname, setNickname] = useState(state.user.nickname);
  const [phone, setPhone] = useState(state.user.phoneNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unchanged = nickname === state.user.nickname && phone === state.user.phoneNumber && Boolean(nickname && phone);

  async function save() {
    if (unchanged) return next();
    setBusy(true);
    const { ok, data } = await postJson("/api/admin/onboarding", { step: "you", nickname, phoneNumber: phone });
    setBusy(false);
    if (!ok) return setError(t("error"));
    setState(data);
    next();
  }
  return (
    <>
      <p className="text-sm font-medium text-ink">{t("youAsk")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label text={t("nickname")}>
          <input className={inputClass} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("nicknamePh")} autoComplete="given-name" />
        </Label>
        <Label text={t("whatsapp")}>
          <input className={inputClass} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("whatsappPh")} autoComplete="tel" />
        </Label>
      </div>
      {footer({ busy, onSave: save, error })}
    </>
  );
}

function StoryStep({ t, state, setState, next, footer }: StepProps) {
  const initial = state.hotel?.description ?? "";
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (text === initial && text.trim()) return next();
    setBusy(true);
    const { ok, data } = await postJson("/api/admin/onboarding", { step: "story", description: text });
    setBusy(false);
    if (!ok) return setError(t("error"));
    setState(data);
    next();
  }
  return (
    <>
      <Label text={t("description")}>
        <textarea className={`${inputClass} resize-none`} rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("descriptionPh")} />
      </Label>
      {footer({ busy, onSave: save, error })}
    </>
  );
}

function MapStep({ t, state, setState, next, footer }: StepProps) {
  const hotel = state.hotel;
  const initialMaps = hotel?.googleMapsUrl || (hotel?.latitude != null && hotel.longitude != null ? `${hotel.latitude}, ${hotel.longitude}` : "");
  const [location, setLocation] = useState(hotel?.location ?? "");
  const [maps, setMaps] = useState(initialMaps);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (location === hotel?.location && maps === initialMaps && location && maps) return next();
    setBusy(true);
    const { ok, data } = await postJson("/api/admin/onboarding", { step: "map", location, maps });
    setBusy(false);
    if (!ok) return setError(data?.error === "map_not_found" ? t("mapNotFound") : t("error"));
    setState(data);
    next();
  }
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[2fr_3fr]">
        <Label text={t("location")}>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("locationPh")} />
        </Label>
        <Label text={t("maps")}>
          <input className={inputClass} value={maps} onChange={(e) => setMaps(e.target.value)} placeholder={t("mapsPh")} inputMode="url" />
        </Label>
      </div>
      <p className="text-xs text-muted">{t("mapsHint")}</p>
      {footer({ busy, onSave: save, error })}
    </>
  );
}

const SITE_GUIDES = {
  airbnb: ["calStepAirbnb1", "calStepAirbnb2", "calStepAirbnb3"],
  booking: ["calStepBooking1", "calStepBooking2", "calStepBooking3"],
  vrbo: ["calStepVrbo1", "calStepVrbo2", "calStepVrbo3"],
  other: ["calStepOther1", "calStepOther2", "calStepOther3"],
} as const satisfies Record<string, readonly OnboardingCopyKey[]>;

type Site = keyof typeof SITE_GUIDES;

function siteOf(urlOrHost: string): Site {
  const text = urlOrHost.toLowerCase();
  if (text.includes("airbnb.")) return "airbnb";
  if (text.includes("booking.com")) return "booking";
  if (/vrbo|homeaway|abritel/.test(text)) return "vrbo";
  return "other";
}

function siteName(t: T, site: Site) {
  return site === "airbnb" ? "Airbnb" : site === "booking" ? "Booking.com" : site === "vrbo" ? "Vrbo" : t("otherSite");
}

function Thumb({ src, className = "h-11 w-11" }: { src: string | null; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${className} shrink-0 rounded-lg object-cover`} />
  ) : (
    <span className={`${className} shrink-0 rounded-lg bg-surface`} />
  );
}

/** Live view of the Gmail import, shown in place of the slide's animation. */
function ImportVisual({ t, job, rooms }: { t: T; job: ImportJob; rooms: OnboardingRoom[] }) {
  const { total, done, ratio } = importProgress(job);
  const cover = (item: ImportItem) => item.cover ?? rooms.find((room) => room.id === item.roomId)?.cover ?? null;
  return (
    <div aria-live="polite" className="relative flex h-44 flex-col overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface via-paper to-card p-4 sm:h-52">
      <div className="flex items-center justify-between text-xs font-medium text-heading">
        <span className="flex items-center gap-2">
          {isRunning(job) ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-aldeitas/30 border-t-aldeitas" /> : <span className="text-[#0f766e]">✓</span>}
          {t(job.status === "scanning" ? "importScanning" : isRunning(job) ? "importCopying" : "importDone")}
        </span>
        {total ? <span className="tabular-nums text-muted">{done}/{total}</span> : null}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
        <div className="h-full rounded-full bg-aldeitas transition-all duration-700" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <div className="mt-3 grid flex-1 grid-cols-4 content-start gap-2 sm:grid-cols-5">
        {(job.items.length ? job.items : Array.from({ length: 5 }, () => null)).slice(0, 10).map((item, i) => (
          <div key={item?.airbnbId ?? i} className={`relative aspect-[4/3] overflow-hidden rounded-lg bg-white/80 ring-1 ring-line/60 ${!item || item.status === "working" ? "animate-pulse" : ""}`}>
            {item && cover(item) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover(item)!} alt="" className="animate-fade-in-scale h-full w-full object-cover" />
            ) : null}
            {item?.status === "failed" ? <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted">—</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomsStep({ t, state, setState, next, footer, importer }: StepProps) {
  const { job, start, markReviewed } = importer;
  const gmail = Boolean(state.hotel?.gmailConnected);
  const needsScan = gmail && job.status === "idle" && (state.rooms.length === 0 || state.rooms.some((room) => room.imageCount === 0));
  useEffect(() => {
    if (needsScan) start();
  }, [needsScan, start]);

  const listed = state.rooms.filter((room) => room.imageCount > 0 || room.airbnbUrl);
  const bare = state.rooms.filter((room) => !(room.imageCount > 0 || room.airbnbUrl));
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [unitPick, setUnitPick] = useState<Record<string, string>>({});
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const created = job.items.filter((item) => item.created && item.roomId).map((item) => item.roomId!);
  const pickFor = (unit: OnboardingRoom, i: number) =>
    unitPick[unit.id] ?? (created[i] && listed.some((room) => room.id === created[i]) ? `same:${created[i]}` : "keep");

  if (needsScan || isRunning(job)) {
    const titleOf = (item: ImportItem) => item.title ?? state.rooms.find((room) => room.id === item.roomId)?.title ?? `Airbnb ${item.airbnbId.slice(-4)}`;
    const label = (item: ImportItem) =>
      item.status === "ok" ? t("photosImported", { count: item.photoCount }) :
      item.status === "linked" ? t("importAlready") :
      item.status === "working" ? t("importWorking") :
      item.status === "failed" ? t("importFailed") : t("importWaiting");
    return (
      <>
        <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1 text-sm">
          {job.items.map((item) => (
            <li key={item.airbnbId} className="flex items-center justify-between gap-3">
              <span className={`truncate ${item.status === "waiting" ? "text-muted" : "text-ink"}`}>{titleOf(item)}</span>
              <span className={`shrink-0 text-xs ${item.status === "ok" || item.status === "linked" ? "text-[#0f766e]" : "text-muted"}`}>{label(item)}</span>
            </li>
          ))}
        </ul>
        {footer({ busy: false, onSave: () => undefined, error: null, locked: true })}
      </>
    );
  }

  async function addListing() {
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    const { ok, data } = await postJson("/api/admin/onboarding/listings", { action: "import", url: url.trim() });
    if (ok) {
      setUrl("");
      setState(await fetch("/api/admin/onboarding").then((r) => r.json()));
    } else {
      setError(t(data?.error === "not_airbnb" ? "notAirbnbLink" : "importFailed"));
    }
    setAdding(false);
  }

  async function save() {
    const renames = listed
      .filter((room) => titles[room.id] != null && titles[room.id].trim() && titles[room.id].trim() !== room.title)
      .map((room) => ({ roomId: room.id, title: titles[room.id].trim() }));
    const merges: Array<{ unitId: string; intoRoomId: string }> = [];
    const removals = [...removing];
    bare.forEach((unit, i) => {
      const pick = pickFor(unit, i);
      if (pick.startsWith("same:")) merges.push({ unitId: unit.id, intoRoomId: pick.slice(5) });
      if (pick === "remove") removals.push(unit.id);
    });
    if (renames.length || merges.length || removals.length) {
      setBusy(true);
      const { ok, data } = await postJson("/api/admin/onboarding/listings", { action: "review", renames, merges, removals });
      setBusy(false);
      if (!ok) return setError(t("error"));
      setState(data);
    }
    markReviewed();
    next();
  }

  return (
    <>
      {job.status === "error" ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
          {t("importError")}{" "}
          <button type="button" onClick={start} className="font-semibold underline underline-offset-2">{t("retry")}</button>
        </p>
      ) : null}
      {listed.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t("reviewFound", { count: listed.length - removing.size })}</p>
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {listed.map((room) => {
              const gone = removing.has(room.id);
              return (
                <div key={room.id} className={`flex items-center gap-3 rounded-xl border border-line bg-white p-2 transition ${gone ? "opacity-50" : ""}`}>
                  <Thumb src={room.cover} />
                  <div className="min-w-0 flex-1">
                    <input
                      aria-label={t("roomName")}
                      disabled={gone}
                      value={titles[room.id] ?? room.title}
                      onChange={(e) => setTitles((v) => ({ ...v, [room.id]: e.target.value }))}
                      className="w-full truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-ink hover:border-line focus:border-aldeitas focus:outline-none"
                    />
                    <div className="px-1 text-[11px] text-muted">
                      {gone ? t("willRemove") : t("photosImported", { count: room.imageCount })}
                      {!gone && room.airbnbUrl ? (
                        <a href={room.airbnbUrl} target="_blank" rel="noreferrer" className="ml-2 text-aldeitas hover:underline">Airbnb ↗</a>
                      ) : null}
                    </div>
                  </div>
                  {room.bookingCount === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setRemoving((set) => {
                          const copy = new Set(set);
                          if (gone) {
                            copy.delete(room.id);
                          } else {
                            copy.add(room.id);
                          }
                          return copy;
                        })
                      }
                      className="shrink-0 rounded-full px-2 py-1 text-xs text-muted hover:bg-surface hover:text-ink"
                    >
                      {gone ? t("undo") : t("removeRoom")}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {bare.length && listed.length ? (
        <div className="space-y-2 rounded-xl bg-surface/60 p-3">
          <p className="text-xs font-medium text-ink">{t("reviewBare")}</p>
          {bare.map((unit, i) => (
            <div key={unit.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-ink">{unit.title}</span>
              <select
                aria-label={unit.title}
                value={pickFor(unit, i)}
                onChange={(e) => setUnitPick((v) => ({ ...v, [unit.id]: e.target.value }))}
                className="max-w-[11rem] shrink-0 rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-ink focus:border-aldeitas focus:outline-none"
              >
                {listed.filter((room) => !removing.has(room.id)).map((room) => (
                  <option key={room.id} value={`same:${room.id}`}>{t("sameAs", { title: titles[room.id] ?? room.title })}</option>
                ))}
                <option value="keep">{t("keepRoom")}</option>
                {unit.bookingCount === 0 ? <option value="remove">{t("removeRoom")}</option> : null}
              </select>
            </div>
          ))}
        </div>
      ) : null}
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted">{t(listed.length ? "reviewMissing" : "airbnbAsk")}</span>
        <div className="flex gap-2">
          <input className={`${inputClass} py-2`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("airbnbPh")} inputMode="url" />
          <button type="button" onClick={addListing} disabled={adding || !url.trim()} className="shrink-0 rounded-xl border border-aldeitas/40 px-3 text-sm font-semibold text-aldeitas hover:bg-aldeitas/5 disabled:opacity-50">
            {adding ? "…" : t("add")}
          </button>
        </div>
        <p className="text-[11px] text-muted">
          {t("airbnbHint")}
          {gmail ? (
            <button type="button" onClick={start} className="ml-2 text-aldeitas hover:underline">{t("rescan")}</button>
          ) : null}
        </p>
      </div>
      {footer({ busy, onSave: save, error })}
    </>
  );
}

function CalendarStep({ t, state, setState, next, footer }: StepProps) {
  const [site, setSite] = useState<Site>("airbnb");
  const [fields, setFields] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(state.rooms.map((room) => [room.id, room.calendarCount === 0 ? [""] : []]))
  );
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (roomId: string, i: number, value: string) =>
    setFields((all) => ({ ...all, [roomId]: (all[roomId] ?? []).map((v, j) => (j === i ? value : v)) }));
  const addField = (roomId: string) => setFields((all) => ({ ...all, [roomId]: [...(all[roomId] ?? []), ""] }));

  async function save() {
    const todo = state.rooms.flatMap((room) =>
      (fields[room.id] ?? []).map((value, i) => ({ room, i, value: value.trim() })).filter((f) => f.value)
    );
    if (todo.length === 0) return next();
    const bad = todo.filter((f) => !/^(https?|webcal):\/\//i.test(f.value));
    if (bad.length) {
      setFailed(new Set(bad.map((f) => `${f.room.id}:${f.i}`)));
      return setError(t("calInvalid"));
    }
    setBusy(true);
    setError(null);
    const broken = new Set<string>();
    for (const f of todo) {
      const icalUrl = f.value.replace(/^webcal:/i, "https:");
      const { ok } = await postJson(`/api/admin/room/${f.room.id}/calendar`, {
        icalUrl,
        name: `${siteName(t, siteOf(icalUrl))} - ${f.room.title}`,
      });
      if (!ok) broken.add(`${f.room.id}:${f.i}`);
    }
    const refreshed: OnboardingState = await fetch("/api/admin/onboarding").then((r) => r.json());
    setState(refreshed);
    setBusy(false);
    setFailed(broken);
    if (broken.size) return setError(t("error"));
    setFields(Object.fromEntries(refreshed.rooms.map((room) => [room.id, room.calendarCount === 0 ? [""] : []])));
    next();
  }

  return (
    <>
      <div className="rounded-xl border border-line bg-surface/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-heading">{t("calGuide")}</span>
          <div role="tablist" className="flex gap-1">
            {(Object.keys(SITE_GUIDES) as Site[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={site === key}
                onClick={() => setSite(key)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${site === key ? "bg-heading text-white" : "text-muted hover:text-ink"}`}
              >
                {siteName(t, key)}
              </button>
            ))}
          </div>
        </div>
        <ol className="mt-2 space-y-1">
          {SITE_GUIDES[site].map((key, i) => (
            <li key={key} className="flex items-start gap-2 text-xs text-ink">
              <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-aldeitas text-[10px] font-semibold text-white">{i + 1}</span>
              {t(key)}
            </li>
          ))}
        </ol>
      </div>
      <p className="text-sm font-medium text-ink">{t("calAskOne")}</p>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {state.rooms.map((room) => {
          const values = fields[room.id] ?? [];
          const last = values[values.length - 1];
          const canAdd = values.length === 0 || Boolean(last?.trim());
          return (
            <div key={room.id} className="rounded-xl border border-line bg-white p-2.5">
              <div className="flex items-center gap-2">
                <Thumb src={room.cover} className="h-7 w-7" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{room.title}</span>
                {room.calendars.map((c, i) => (
                  <span key={i} className="shrink-0 rounded-full bg-[#0f766e]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0f766e]">
                    {siteName(t, siteOf(c.host || c.name))} ✓
                  </span>
                ))}
              </div>
              {values.map((value, i) => (
                <div key={i} className="relative mt-2">
                  <input
                    className={`${inputClass} py-2 pr-24 ${failed.has(room.id + ":" + i) ? "border-red-400" : ""}`}
                    value={value}
                    onChange={(e) => setField(room.id, i, e.target.value)}
                    placeholder={i === 0 && room.calendarCount === 0 ? t("calPh") : t("calPhMore")}
                    inputMode="url"
                  />
                  {value.trim() ? (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted">{siteName(t, siteOf(value))}</span>
                  ) : null}
                </div>
              ))}
              {canAdd ? (
                <button type="button" onClick={() => addField(room.id)} className="mt-1.5 text-xs font-medium text-aldeitas hover:underline">
                  {t("addSite")}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <details className="rounded-xl bg-surface/60 px-3 py-2 text-xs text-muted">
        <summary className="cursor-pointer font-medium text-ink">{t("calBack")}</summary>
        <p className="mt-1">{t("calBackHint")}</p>
        <div className="mt-2 space-y-1.5">
          {state.rooms.map((room) => (
            <CopyLink key={room.id} t={t} url={room.exportUrl} label={room.title} />
          ))}
        </div>
      </details>
      {footer({ busy, onSave: save, error })}
    </>
  );
}

function InboxStep({ t, state, setState, next, footer, importer, ensureNext }: StepProps) {
  const hotel = state.hotel;
  const [email, setEmail] = useState(hotel?.gmailEmail ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!hotel || (hotel.gmailConnected && !password && email === hotel.gmailEmail)) return next();
    setBusy(true);
    const { ok, data } = await postJson(`/api/admin/hotel/${hotel.id}/gmail-sync`, { email, appPassword: password }, "PUT");
    if (!ok) {
      setBusy(false);
      return setError(typeof data?.error === "string" ? data.error : t("error"));
    }
    setState(await fetch("/api/admin/onboarding").then((r) => r.json()));
    setBusy(false);
    importer.start();
    ensureNext("airbnb");
    next();
  }
  return (
    <>
      <p className="text-sm font-medium text-ink">{t("inboxAsk")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label text={t("gmail")}>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("gmailPh")} autoComplete="email" />
        </Label>
        <Label text={t("gmailCode")}>
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={hotel?.gmailConnected ? "••••••••••••••••" : "abcd efgh ijkl mnop"} autoComplete="off" />
        </Label>
      </div>
      <p className="text-xs text-muted">
        {t("gmailCodeHint")}{" "}
        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="font-medium text-aldeitas underline-offset-2 hover:underline">
          {t("gmailCodeLink")} ↗
        </a>
      </p>
      {footer({ busy, onSave: save, error })}
    </>
  );
}

function CopyLink({ t, url, label }: { t: T; url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted">{label}</div>
        <a href={url} target="_blank" rel="noreferrer" className="block truncate text-xs font-medium text-ink hover:text-aldeitas">{url}</a>
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
        className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-paper"
      >
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}

function TeamStep({ t, state, setState, next, footer }: StepProps) {
  const [cleanerName, setCleanerName] = useState(state.cleaner?.name ?? "");
  const [cleanerPhone, setCleanerPhone] = useState(state.cleaner?.phone ?? "");
  const [maintName, setMaintName] = useState(state.maintenance?.name ?? "");
  const [maintPhone, setMaintPhone] = useState(state.maintenance?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const unchanged =
      cleanerName === (state.cleaner?.name ?? "") && cleanerPhone === (state.cleaner?.phone ?? "") &&
      maintName === (state.maintenance?.name ?? "") && maintPhone === (state.maintenance?.phone ?? "");
    if (unchanged && state.cleaner) return next();
    setBusy(true);
    const { ok, data } = await postJson("/api/admin/onboarding", {
      step: "team",
      cleaner: { name: cleanerName, phone: cleanerPhone },
      ...(maintName.trim() && maintPhone.trim() ? { maintenance: { name: maintName, phone: maintPhone } } : {}),
    });
    setBusy(false);
    if (!ok) return setError(t("error"));
    setState(data);
    next();
  }
  return (
    <>
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
        <Label text={`${t("cleaner")} · ${t("name")}`}>
          <input className={inputClass} value={cleanerName} onChange={(e) => setCleanerName(e.target.value)} />
        </Label>
        <Label text={t("phone")}>
          <input className={inputClass} type="tel" value={cleanerPhone} onChange={(e) => setCleanerPhone(e.target.value)} />
        </Label>
        <Label text={`${t("maintenance")} · ${t("name")}`}>
          <input className={inputClass} value={maintName} onChange={(e) => setMaintName(e.target.value)} />
        </Label>
        <Label text={t("phone")}>
          <input className={inputClass} type="tel" value={maintPhone} onChange={(e) => setMaintPhone(e.target.value)} />
        </Label>
      </div>
      {state.publicCalendarUrl ? <CopyLink t={t} url={state.publicCalendarUrl} label={t("cleanerLink")} /> : null}
      {footer({ busy, onSave: save, error })}
    </>
  );
}

function DoneStep({ t, state, close }: { t: T; state: OnboardingState; close: () => void }) {
  return (
    <>
      {state.ownerCalendarUrl ? <CopyLink t={t} url={state.ownerCalendarUrl} label={t("ownerLink")} /> : null}
      <div className="flex justify-end pt-1">
        <button type="button" onClick={close} className="rounded-full bg-heading px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink">
          {t("finish")}
        </button>
      </div>
    </>
  );
}

const STEP_COPY: Record<DemoId, { kicker: OnboardingCopyKey; title: OnboardingCopyKey; body: OnboardingCopyKey }> = {
  you: { kicker: "youKicker", title: "youTitle", body: "youBody" },
  story: { kicker: "storyKicker", title: "storyTitle", body: "storyBody" },
  map: { kicker: "mapKicker", title: "mapTitle", body: "mapBody" },
  airbnb: { kicker: "airbnbKicker", title: "airbnbTitle", body: "airbnbBody" },
  calendars: { kicker: "calKicker", title: "calTitle", body: "calBody" },
  inbox: { kicker: "inboxKicker", title: "inboxTitle", body: "inboxBody" },
  team: { kicker: "teamKicker", title: "teamTitle", body: "teamBody" },
  done: { kicker: "doneKicker", title: "doneTitle", body: "doneBody" },
};

const IMPORT_COPY = { kicker: "importKicker", title: "importTitle", body: "importBody" } as const;
const REVIEW_COPY = { kicker: "reviewKicker", title: "reviewTitle", body: "reviewBody" } as const;

function stepsFor(mode: "full" | "missing", state: OnboardingState, importer: Pick<Importer, "job" | "reviewed">): DemoId[] {
  const available = (id: DemoId) => id === "you" || id === "done" || Boolean(state.hotel);
  if (mode === "full") return FULL_TOUR.filter(available);
  const wanted = new Set<DemoId>(state.missing);
  if (isRunning(importer.job) || (importer.job.status === "done" && !importer.reviewed)) wanted.add("airbnb");
  return FULL_TOUR.filter((id) => wanted.has(id) && available(id));
}

function Slideshow({
  t, mode, state, setState, onClose, importer,
}: {
  t: T;
  mode: "full" | "missing";
  state: OnboardingState;
  setState: (state: OnboardingState) => void;
  onClose: () => void;
  importer: Importer;
}) {
  const [steps, setSteps] = useState(() => stepsFor(mode, state, importer));
  const [index, setIndex] = useState(() => (isRunning(importer.job) ? Math.max(0, steps.indexOf("airbnb")) : 0));
  const id = steps[index];
  const ensureNext = (step: DemoId) =>
    setSteps((list) => (list.includes(step) ? list : [...list.slice(0, index + 1), step, ...list.slice(index + 1)]));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const next = () => (index + 1 < steps.length ? setIndex(index + 1) : onClose());
  const importing = id === "airbnb" && isRunning(importer.job);
  const reviewing =
    id === "airbnb" && !importing && (Boolean(state.hotel?.gmailConnected) || state.rooms.some((room) => room.imageCount > 0));
  const copy = importing ? IMPORT_COPY : reviewing ? REVIEW_COPY : STEP_COPY[id];

  const footer = ({ busy, onSave, error, locked }: FooterOpts) => (
    <div className="space-y-2 pt-1">
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => (index > 0 ? setIndex(index - 1) : onClose())}
          className="rounded-full px-3 py-2 text-sm text-muted hover:text-ink"
        >
          {index > 0 ? `← ${t("back")}` : t("later")}
        </button>
        <div className="flex items-center gap-2">
          {index > 0 && !locked ? (
            <button type="button" onClick={next} className="rounded-full px-3 py-2 text-sm text-muted hover:text-ink">
              {t("later")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={busy || locked}
            className="rounded-full bg-aldeitas px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60"
          >
            {locked ? t("importWait") : busy ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );

  const props: StepProps = { t, state, setState, next, footer, importer, ensureNext };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in-scale relative max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-muted shadow-sm hover:text-ink"
        >
          ×
        </button>
        {importing ? (
          <ImportVisual t={t} job={importer.job} rooms={state.rooms} />
        ) : reviewing ? null : (
          <OnboardingDemo key={id} id={id} t={t} />
        )}
        <div className={`${reviewing ? "mt-1 pr-10" : "mt-4"} flex items-center gap-1.5`} aria-label={t("stepOf", { n: index + 1, total: steps.length })}>
          {steps.map((step, i) => (
            <span key={step} className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-aldeitas" : i < index ? "w-1.5 bg-aldeitas/50" : "w-1.5 bg-line"}`} />
          ))}
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-aldeitas">{t(copy.kicker)}</div>
            <h2 id="onboarding-title" className="mt-1 font-display text-xl font-bold text-heading sm:text-2xl">{t(copy.title)}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t(copy.body)}</p>
          </div>
          <div key={`form-${id}`} className="space-y-3">
            {id === "you" ? <YouStep {...props} /> : null}
            {id === "story" ? <StoryStep {...props} /> : null}
            {id === "map" ? <MapStep {...props} /> : null}
            {id === "airbnb" ? <RoomsStep {...props} /> : null}
            {id === "calendars" ? <CalendarStep {...props} /> : null}
            {id === "inbox" ? <InboxStep {...props} /> : null}
            {id === "team" ? <TeamStep {...props} /> : null}
            {id === "done" ? <DoneStep t={t} state={state} close={onClose} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Navbar entry point: shows a "finish setup" pill while info is missing and hosts the slideshow. */
export default function OwnerOnboarding({ userId }: { userId: string }) {
  const { locale } = useLocale();
  const pathname = usePathname();
  const t: T = useCallback((key, vars) => onboardingText(locale, key, vars), [locale]);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [mode, setMode] = useState<"full" | "missing" | null>(null);
  const [job, setJob] = useState<ImportJob>({ status: "idle", items: [] });
  const [reviewed, setReviewed] = useState(false);
  const running = useRef(false);

  const startImport = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setReviewed(false);
    setJob({ status: "scanning", items: [] });
    let items: ImportItem[] = [];
    try {
      const res = await fetch("/api/admin/onboarding/listings");
      if (!res.ok) throw new Error("scan failed");
      const { listings } = (await res.json()) as { listings: GmailListing[] };
      items = listings.map((listing) => ({
        airbnbId: listing.airbnbId,
        roomId: listing.roomId,
        title: null,
        cover: null,
        photoCount: 0,
        created: false,
        status: listing.roomId ? "linked" : "waiting",
      }));
      setJob({ status: "importing", items });
      for (const item of items) {
        if (item.status === "linked") continue;
        const patch = (change: Partial<ImportItem>) => {
          items = items.map((it) => (it.airbnbId === item.airbnbId ? { ...it, ...change } : it));
          setJob({ status: "importing", items });
        };
        patch({ status: "working" });
        const { ok, data } = await postJson("/api/admin/onboarding/listings", { action: "import", airbnbId: item.airbnbId });
        patch(
          ok
            ? { status: "ok", roomId: data.roomId, title: data.title, cover: data.cover, photoCount: data.photoCount, created: Boolean(data.created) }
            : { status: "failed" }
        );
      }
      const fresh = await fetch("/api/admin/onboarding").then((r) => r.json());
      if (Array.isArray(fresh?.missing)) setState(fresh);
      setJob({ status: "done", items });
    } catch {
      setJob({ status: "error", items });
    } finally {
      running.current = false;
    }
  }, []);

  const importer: Importer = { job, start: startImport, reviewed, markReviewed: () => setReviewed(true) };

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OnboardingState | null) => {
        if (!alive || !Array.isArray(data?.missing)) return;
        setState(data);
        const welcome = new URLSearchParams(window.location.search).has("welcome");
        if (welcome || !window.localStorage.getItem(`${SEEN_KEY}:${userId}`)) {
          setMode((current) => current ?? "full");
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, pathname]);

  useEffect(() => {
    const open = () => setMode("full");
    window.addEventListener(OPEN_TOUR_EVENT, open);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, open);
  }, []);

  const close = useCallback(() => {
    window.localStorage.setItem(`${SEEN_KEY}:${userId}`, "1");
    setMode(null);
  }, [userId]);

  if (!state) return null;
  const missingSteps = stepsFor("missing", state, { job, reviewed });
  const progress = importProgress(job);
  const missingCount = missingSteps.length;
  const listingsOnly = missingSteps.every((step) => LISTING_STEPS.has(step));

  return (
    <>
      {missingCount > 0 || isRunning(job) ? (
        <button
          type="button"
          onClick={() => setMode("missing")}
          aria-label={isRunning(job) ? (job.status === "scanning" ? t("importWait") : t("navImporting", { done: progress.done, total: progress.total })) : t("navButtonAria", { count: missingCount })}
          className="group flex items-center gap-2 rounded-full border border-aldeitas/30 bg-aldeitas/5 py-1.5 pl-2 pr-3 text-sm font-semibold text-aldeitas transition hover:border-aldeitas/60 hover:bg-aldeitas/10"
        >
          {isRunning(job) ? (
            <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90" aria-hidden>
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
              <circle
                cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={50.27} strokeDashoffset={50.27 * (1 - progress.ratio)}
                className="transition-[stroke-dashoffset] duration-700"
              />
            </svg>
          ) : (
            <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-aldeitas text-[11px] text-white">
              {missingCount}
            </span>
          )}
          <span className="hidden md:inline">
            {isRunning(job)
              ? (job.status === "scanning" ? t("importWait") : t("navImporting", { done: progress.done, total: progress.total }))
              : t(listingsOnly ? "navButtonListings" : "navButton")}
          </span>
        </button>
      ) : null}
      {mode
        ? createPortal(
            <Slideshow key={mode} t={t} mode={mode} state={state} setState={setState} onClose={close} importer={importer} />,
            document.body
          )
        : null}
    </>
  );
}

export function OpenTourButton({ className = "" }: { className?: string }) {
  const { locale } = useLocale();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_TOUR_EVENT))}
      className={className}
    >
      {onboardingText(locale, "tourButton")}
    </button>
  );
}

