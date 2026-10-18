"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale-context";
import { onboardingText, type OnboardingCopyKey } from "@/lib/i18n/onboarding-copy";
import type { DiscoveredListing } from "@/lib/gmail-listing-discovery";
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
  footer: (opts: { busy: boolean; onSave: () => void; error: string | null }) => ReactNode;
};

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

const SKIP = "skip";
const NEW_ROOM = "new";

function nameWords(text: string) {
  return new Set(
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2)
  );
}

function defaultPicks(found: DiscoveredListing[], rooms: OnboardingRoom[]) {
  const free = rooms.filter((room) => !room.airbnbUrl && !found.some((f) => f.roomId === room.id));
  const picks: Record<string, string> = {};
  for (const listing of found) {
    if (listing.roomId) continue;
    const words = nameWords(listing.title ?? "");
    const byName = free.find((room) => [...nameWords(room.title)].some((w) => words.has(w)));
    const room = byName ?? free[0];
    picks[listing.airbnbId] = room ? room.id : NEW_ROOM;
    if (room) free.splice(free.indexOf(room), 1);
  }
  return picks;
}

function GmailListings({
  t, rooms, found, picks, setPicks,
}: {
  t: T;
  rooms: OnboardingRoom[];
  found: DiscoveredListing[] | "loading" | "error";
  picks: Record<string, string>;
  setPicks: (update: (picks: Record<string, string>) => Record<string, string>) => void;
}) {
  if (found === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-3 text-sm text-muted">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-aldeitas/30 border-t-aldeitas" />
        {t("gmailFinding")}
      </div>
    );
  }
  if (found === "error" || found.length === 0) {
    return <p className="rounded-xl bg-surface/60 px-3 py-2 text-xs text-muted">{t("gmailNone")}</p>;
  }
  const roomTitle = (id: string | null) => rooms.find((room) => room.id === id)?.title ?? "";
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{t("gmailFound")}</p>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {found.map((listing) => (
          <div key={listing.airbnbId} className="flex items-center gap-3 rounded-xl border border-line bg-white p-2">
            {listing.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.photo} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="h-11 w-11 shrink-0 rounded-lg bg-surface" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{listing.title ?? listing.airbnbUrl}</div>
              <div className="text-[11px] text-muted">{t("bookingsCount", { count: listing.bookings })}</div>
            </div>
            {listing.roomId ? (
              <span className="shrink-0 text-xs font-medium text-[#0f766e]">✓ {roomTitle(listing.roomId)}</span>
            ) : (
              <select
                aria-label={listing.title ?? listing.airbnbId}
                value={picks[listing.airbnbId] ?? NEW_ROOM}
                onChange={(e) => setPicks((p) => ({ ...p, [listing.airbnbId]: e.target.value }))}
                className="max-w-[9rem] shrink-0 rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-ink focus:border-aldeitas focus:outline-none"
              >
                {rooms.filter((room) => !found.some((f) => f.roomId === room.id)).map((room) => (
                  <option key={room.id} value={room.id}>{room.title}</option>
                ))}
                <option value={NEW_ROOM}>+ {t("newRoom")}</option>
                <option value={SKIP}>{t("skipListing")}</option>
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomLinksStep({
  t, state, setState, next, footer, kind,
}: StepProps & { kind: "airbnb" | "calendars" }) {
  const isDone = (room: OnboardingRoom) =>
    kind === "airbnb" ? Boolean(room.airbnbUrl) && room.imageCount > 0 : room.calendarCount > 0;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(state.rooms.map((room) => [room.id, kind === "airbnb" ? room.airbnbUrl : ""]))
  );
  const [status, setStatus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const useGmail = kind === "airbnb" && Boolean(state.hotel?.gmailConnected);
  const [found, setFound] = useState<DiscoveredListing[] | "loading" | "error">(useGmail ? "loading" : []);
  const [picks, setPicks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!useGmail) return;
    let alive = true;
    fetch("/api/admin/onboarding/listings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("search failed"))))
      .then((data: { listings: DiscoveredListing[] }) => {
        if (!alive) return;
        setFound(data.listings);
        setPicks(defaultPicks(data.listings, state.rooms));
      })
      .catch(() => alive && setFound("error"));
    return () => {
      alive = false;
    };
    // Search once per slide; later state refreshes must not re-scan Gmail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGmail]);

  async function linkFromGmail() {
    if (!Array.isArray(found)) return true;
    const links = found
      .filter((listing) => !listing.roomId && picks[listing.airbnbId] !== SKIP)
      .map((listing) => {
        const pick = picks[listing.airbnbId] ?? NEW_ROOM;
        return { airbnbId: listing.airbnbId, roomId: pick === NEW_ROOM ? null : pick, title: listing.title ?? undefined };
      });
    if (links.length === 0) return true;
    const { ok, data } = await postJson("/api/admin/onboarding/listings", { links });
    if (data?.state) setState(data.state);
    return ok && Array.isArray(data?.results) && data.results.every((r: { ok: boolean }) => r.ok);
  }

  async function save() {
    if (useGmail && Array.isArray(found) && found.length > 0) {
      setBusy(true);
      setError(null);
      const linked = await linkFromGmail();
      setBusy(false);
      if (!linked) return setError(t("error"));
    }
    const todo = state.rooms.filter((room) => {
      const value = values[room.id]?.trim();
      if (!value) return false;
      return kind === "airbnb" ? !(isDone(room) && value === room.airbnbUrl) : true;
    });
    if (todo.length === 0) return next();
    setBusy(true);
    setError(null);
    let failed = false;
    for (const room of todo) {
      setStatus((s) => ({ ...s, [room.id]: kind === "airbnb" ? t("importing") : "…" }));
      const { ok, data } =
        kind === "airbnb"
          ? await postJson(`/api/admin/room/${room.id}/import-airbnb`, {
              airbnbUrl: values[room.id].trim(),
              importPhotos: true,
              importDescription: !room.hasDescription,
            })
          : await postJson(`/api/admin/room/${room.id}/calendar`, { icalUrl: values[room.id].trim() });
      failed ||= !ok;
      setStatus((s) => ({
        ...s,
        [room.id]: ok
          ? kind === "airbnb" ? t("photosImported", { count: data.photoCount ?? 0 }) : t("connected")
          : "✕",
      }));
      if (ok && kind === "calendars") setValues((v) => ({ ...v, [room.id]: "" }));
    }
    const refreshed = await fetch("/api/admin/onboarding").then((r) => r.json());
    setState(refreshed);
    setBusy(false);
    if (failed) return setError(t("error"));
    next();
  }

  return (
    <>
      {useGmail ? <GmailListings t={t} rooms={state.rooms} found={found} picks={picks} setPicks={setPicks} /> : null}
      {useGmail && Array.isArray(found) && found.length > 0 ? null : (
        <p className="text-sm font-medium text-ink">{t(kind === "airbnb" ? "airbnbAsk" : "calAsk")}</p>
      )}
      <div className={`max-h-56 space-y-2 overflow-y-auto pr-1 ${useGmail && found !== "error" && (found === "loading" || found.length > 0) ? "hidden" : ""}`}>
        {state.rooms.map((room) => (
          <div key={room.id} className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-2 sm:grid-cols-[9rem_1fr]">
            <span className="truncate text-sm text-ink">
              {isDone(room) ? <span className="mr-1 text-[#0f766e]">✓</span> : null}
              {room.title}
            </span>
            <div className="relative">
              <input
                className={`${inputClass} py-2 pr-20`}
                value={values[room.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [room.id]: e.target.value }))}
                placeholder={kind === "calendars" && isDone(room) ? t("connected") : t(kind === "airbnb" ? "airbnbPh" : "calPh")}
                inputMode="url"
              />
              {status[room.id] ? (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">{status[room.id]}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {useGmail && found !== "error" && (found === "loading" || found.length > 0) ? null : (
        <p className="text-xs text-muted">{t(kind === "airbnb" ? "airbnbHint" : "calHint")}</p>
      )}
      {footer({ busy, onSave: save, error })}
    </>
  );
}

function InboxStep({ t, state, setState, next, footer }: StepProps) {
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

function stepsFor(mode: "full" | "missing", state: OnboardingState): DemoId[] {
  const available = (id: DemoId) => id === "you" || id === "done" || Boolean(state.hotel);
  if (mode === "full") return FULL_TOUR.filter(available);
  return state.missing.filter(available);
}

function Slideshow({
  t, mode, state, setState, onClose,
}: {
  t: T;
  mode: "full" | "missing";
  state: OnboardingState;
  setState: (state: OnboardingState) => void;
  onClose: () => void;
}) {
  const [steps] = useState(() => stepsFor(mode, state));
  const [index, setIndex] = useState(0);
  const id = steps[index];

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
  const copy = STEP_COPY[id];

  const footer = ({ busy, onSave, error }: { busy: boolean; onSave: () => void; error: string | null }) => (
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
          {index > 0 ? (
            <button type="button" onClick={next} className="rounded-full px-3 py-2 text-sm text-muted hover:text-ink">
              {t("later")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="rounded-full bg-aldeitas px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );

  const props: StepProps = { t, state, setState, next, footer };

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
        <OnboardingDemo key={id} id={id} t={t} />
        <div className="mt-4 flex items-center gap-1.5" aria-label={t("stepOf", { n: index + 1, total: steps.length })}>
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
            {id === "airbnb" ? <RoomLinksStep {...props} kind="airbnb" /> : null}
            {id === "calendars" ? <RoomLinksStep {...props} kind="calendars" /> : null}
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
  const missingSteps = stepsFor("missing", state);
  const missingCount = missingSteps.length;
  const listingsOnly = missingSteps.every((step) => LISTING_STEPS.has(step));

  return (
    <>
      {missingCount > 0 ? (
        <button
          type="button"
          onClick={() => setMode("missing")}
          aria-label={t("navButtonAria", { count: missingCount })}
          className="group flex items-center gap-2 rounded-full border border-aldeitas/30 bg-aldeitas/5 py-1.5 pl-2 pr-3 text-sm font-semibold text-aldeitas transition hover:border-aldeitas/60 hover:bg-aldeitas/10"
        >
          <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-aldeitas text-[11px] text-white">
            {missingCount}
          </span>
          <span className="hidden md:inline">{t(listingsOnly ? "navButtonListings" : "navButton")}</span>
        </button>
      ) : null}
      {mode
        ? createPortal(
            <Slideshow key={mode} t={t} mode={mode} state={state} setState={setState} onClose={close} />,
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

