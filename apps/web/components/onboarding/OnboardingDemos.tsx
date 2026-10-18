"use client";

import type { CSSProperties, ReactNode } from "react";
import type { OnboardingCopyKey } from "@/lib/i18n/onboarding-copy";

type T = (key: OnboardingCopyKey) => string;

export type DemoId = "you" | "story" | "map" | "airbnb" | "calendars" | "inbox" | "team" | "done";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="relative h-44 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface via-paper to-card sm:h-52"
    >
      {children}
    </div>
  );
}

function Cursor({ path }: { path: [string, string, string, string, string, string] }) {
  const [x0, y0, x1, y1, x2, y2] = path;
  const style = {
    "--x0": x0, "--y0": y0, "--x1": x1, "--y1": y1, "--x2": x2, "--y2": y2,
  } as CSSProperties;
  return (
    <svg
      viewBox="0 0 24 24"
      className="ob-loop ob-cursor pointer-events-none absolute left-0 top-0 z-20 h-5 w-5 drop-shadow"
      style={style}
    >
      <path d="M4 2l15 9-6.5 1.6L9.6 19z" fill="#3D3B38" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function Field({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`flex h-8 items-center rounded-lg border border-line bg-white px-2.5 text-[11px] text-ink shadow-sm ${className}`}>
      <span className="ob-loop ob-type">{text}</span>
      <span className="ml-px h-3.5 w-px animate-pulse bg-aldeitas" />
    </div>
  );
}

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <div className={`ob-loop rounded-md px-2 py-1 text-[10px] font-semibold ${className}`}>{children}</div>;
}

function YouDemo({ t }: { t: T }) {
  return (
    <Frame>
      <div className="absolute left-5 top-8 w-[46%] space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{t("whatsapp")}</div>
        <Field text="+52 954 123 4567" />
      </div>
      <div className="absolute right-6 top-4 h-[150%] w-28 rounded-[1.4rem] border-4 border-heading/80 bg-[#efe9df] p-2 sm:w-32">
        <div className="ob-loop ob-in-50 mt-6 rounded-xl rounded-tl-sm bg-white p-2 text-[9px] leading-snug text-ink shadow">
          <div className="font-semibold text-aldeitas">{t("demoBooking")}</div>
          Treehouse 3 · {t("demoGuests")}
          <div className="font-semibold">MX$1,350</div>
        </div>
      </div>
      <Cursor path={["30%", "90%", "20%", "60%", "24%", "62%"]} />
    </Frame>
  );
}

function StoryDemo({ t }: { t: T }) {
  return (
    <Frame>
      <div className="absolute inset-x-5 top-5 rounded-xl border border-line bg-white p-3 shadow-sm">
        <div className="mb-2 h-16 rounded-lg bg-[linear-gradient(135deg,#0f766e33,#9a7b5233)]" />
        <div className="text-[11px] text-ink">
          <span className="ob-loop ob-type">{t("descriptionPh")}</span>
        </div>
      </div>
      <div className="absolute bottom-4 right-5 flex gap-1.5">
        <Pill className="ob-in-50 bg-aldeitas text-white">ES</Pill>
        <Pill className="ob-in-60 bg-heading text-white">EN</Pill>
      </div>
    </Frame>
  );
}

function MapDemo({ t }: { t: T }) {
  return (
    <Frame>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 200" preserveAspectRatio="none">
        <path d="M0 150 C80 130 120 170 200 150 S300 120 320 135 V200 H0Z" fill="#cfe7e6" />
        {[40, 90, 140, 190, 240, 290].map((x) => (
          <line key={x} x1={x} y1="0" x2={x - 30} y2="200" stroke="#e7e0d6" strokeWidth="1" />
        ))}
        <path d="M0 70 C100 60 200 95 320 80" stroke="#fff" strokeWidth="6" fill="none" />
      </svg>
      <div className="absolute left-5 top-5 w-[62%]">
        <Field text="maps.app.goo.gl/xK2p" />
      </div>
      <div className="ob-loop ob-pin absolute left-[58%] top-[44%]">
        <svg viewBox="0 0 24 32" className="h-9 w-7 drop-shadow-md">
          <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.5 12 32 12 32s12-11.5 12-20.3C24 5.2 18.6 0 12 0z" fill="#0f766e" />
          <circle cx="12" cy="11.5" r="4.5" fill="#fff" />
        </svg>
      </div>
      <Cursor path={["80%", "85%", "30%", "18%", "34%", "20%"]} />
    </Frame>
  );
}

const PHOTO_TONES = ["#c9b79c", "#8fb5ae", "#d8c6a8", "#a7c4bd"];

function AirbnbDemo() {
  const delays = ["ob-in-35", "ob-in-50", "ob-in-60", "ob-in-70"];
  return (
    <Frame>
      <div className="absolute left-5 right-5 top-5 flex gap-2">
        <Field text="airbnb.mx/rooms/1053572" className="flex-1" />
        <div className="ob-loop ob-press flex h-8 items-center rounded-lg bg-aldeitas px-3 text-[11px] font-semibold text-white">↓</div>
      </div>
      <div className="absolute left-5 right-5 top-16 grid grid-cols-4 gap-2">
        {PHOTO_TONES.map((tone, i) => (
          <div key={tone} className={`ob-loop ${delays[i]} h-14 rounded-lg`} style={{ background: `linear-gradient(160deg, ${tone}, #fffdfa)` }} />
        ))}
      </div>
      <div className="absolute bottom-4 left-5 right-5 grid grid-cols-6 gap-1 text-center text-[10px] text-muted">
        {["$1.9k", "$1.9k", "$2.3k", "$2.3k", "$2.7k", "$2.1k"].map((p, i) => (
          <div key={i} className="ob-loop ob-in-70 rounded border border-line bg-white py-1">{p}</div>
        ))}
      </div>
      <Cursor path={["50%", "90%", "40%", "14%", "88%", "14%"]} />
    </Frame>
  );
}

function CalendarsDemo({ t }: { t: T }) {
  const rows = [
    { label: "Airbnb", bar: "bg-[#0f766e]", left: "8%", width: "38%", anim: "ob-grow" },
    { label: "Booking", bar: "bg-[#41618a]", left: "50%", width: "30%", anim: "ob-grow-late" },
    { label: "Vrbo", bar: "bg-[#9a7b52]", left: "22%", width: "44%", anim: "ob-grow" },
  ];
  return (
    <Frame>
      <div className="absolute left-5 top-5 flex items-center gap-2">
        <div className="ob-loop ob-press rounded-lg border border-line bg-white px-2.5 py-1.5 text-[10px] font-semibold text-ink shadow-sm">
          {t("demoExport")}
        </div>
        <Pill className="ob-in-20 bg-heading text-white">{t("demoCopied")} ✓</Pill>
      </div>
      <div className="absolute inset-x-5 bottom-4 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="w-12 text-[10px] text-muted">{row.label}</span>
            <div className="relative h-5 flex-1 rounded bg-white/80">
              <div className={`ob-loop ${row.anim} absolute inset-y-0 rounded ${row.bar}`} style={{ left: row.left, width: row.width }} />
            </div>
          </div>
        ))}
      </div>
      <Cursor path={["60%", "60%", "14%", "12%", "14%", "12%"]} />
    </Frame>
  );
}

function GmailMark() {
  return (
    <svg viewBox="0 0 24 18" className="h-3 w-4">
      <path d="M1.6 18H5.5V8.6L0 4.5V16.4C0 17.3.7 18 1.6 18Z" fill="#4285F4" />
      <path d="M18.5 18h3.9c.9 0 1.6-.7 1.6-1.6V4.5l-5.5 4.1Z" fill="#34A853" />
      <path d="M18.5 1.5v7.1L24 4.5V2.3C24 .3 21.7-.8 20.1.4Z" fill="#FBBC04" />
      <path d="M5.5 8.6V1.5L12 6.4l6.5-4.9v7.1L12 13.5Z" fill="#EA4335" />
      <path d="M0 2.3v2.2l5.5 4.1V1.5L3.9.4C2.3-.8 0 .3 0 2.3Z" fill="#C5221F" />
    </svg>
  );
}

const MAILS = [
  { from: "Airbnb", guest: "Laura M.", room: 0, left: "4%", right: "22%" },
  { from: "Booking.com", guest: "John D.", room: 1, left: "38%", right: "4%" },
  { from: "Vrbo", guest: "Ana R.", room: 2, left: "12%", right: "36%" },
] as const;

function InboxDemo({ t }: { t: T }) {
  return (
    <Frame>
      <div className="absolute inset-y-3 left-3 w-[46%] overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-line/70 px-2 py-1.5">
          <GmailMark />
          <span className="text-[10px] font-medium text-[#5f6368]">Gmail</span>
          <span className="ml-1 h-3 flex-1 rounded-full bg-[#f1f3f4]" />
        </div>
        {MAILS.map((m, i) => (
          <div key={m.from} className={`ob-loop ob-mail ob-mail-${i} border-b border-line/50 px-2 py-1.5`}>
            <div className="flex items-baseline justify-between gap-1">
              <span className="truncate text-[10px] font-bold text-[#202124]">{m.from}</span>
              <span className="text-[8px] text-[#5f6368]">9:4{i}</span>
            </div>
            <div className="truncate text-[9px] text-[#5f6368]">
              <span className="font-semibold text-[#202124]">{t("demoMailSubject")}</span> · {m.guest}
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-y-3 right-3 w-[42%] rounded-xl border border-line bg-paper p-2 shadow-sm">
        <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-heading">
          <span className="h-1.5 w-1.5 rounded-full bg-aldeitas" />
          Aldeitas
        </div>
        <div className="space-y-2">
          {MAILS.map((m, i) => (
            <div key={m.room} className="flex items-center gap-1.5">
              <span className="w-4 text-[8px] text-muted">T{m.room + 1}</span>
              <div className="relative h-5 flex-1 rounded bg-white/90 ring-1 ring-line/60">
                <div
                  className={`ob-loop ob-land ob-land-${i} absolute inset-y-0 flex items-center overflow-hidden rounded bg-[#0f766e] px-1.5 text-[8px] font-medium text-white`}
                  style={{ left: m.left, right: m.right }}
                >
                  <span className="truncate">{m.guest}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {MAILS.map((m, i) => (
        <div
          key={m.guest}
          className={`ob-loop ob-hop ob-hop-${i} absolute z-10 rounded-md bg-[#0f766e] px-1.5 py-0.5 text-[8px] font-semibold text-white shadow-md`}
        >
          {m.guest}
        </div>
      ))}
    </Frame>
  );
}

function TeamDemo({ t }: { t: T }) {
  return (
    <Frame>
      <div className="absolute left-1/2 top-4 h-[150%] w-40 -translate-x-1/2 rounded-[1.4rem] border-4 border-heading/80 bg-paper p-2.5">
        <div className="ob-loop ob-in-20 rounded-lg bg-aldeitas/10 px-2 py-1 text-[10px] font-semibold text-aldeitas">{t("demoCheckouts")}</div>
        <div className="mt-2 space-y-1.5">
          {["w-3/4", "w-1/2", "w-2/3"].map((w, i) => (
            <div key={w} className="flex items-center gap-1.5">
              <span className="w-5 text-[9px] text-muted">{i + 1}</span>
              <div className={`ob-loop ${i === 1 ? "ob-grow-late" : "ob-grow"} h-3.5 ${w} rounded bg-[#0f766e]`} />
            </div>
          ))}
        </div>
        <div className="ob-loop ob-in-70 mt-2 text-[9px] text-muted">👤👤 · 👤👤👤</div>
      </div>
    </Frame>
  );
}

function Ring({ to, label, value }: { to: number; label: string; value: string }) {
  const full = 2 * Math.PI * 22;
  const style = { "--ring-full": `${full}`, "--ring-to": `${full * (1 - to)}`, strokeDasharray: full } as CSSProperties;
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 52 52" className="h-14 w-14 -rotate-90">
        <circle cx="26" cy="26" r="22" fill="none" stroke="#e7e0d6" strokeWidth="6" />
        <circle cx="26" cy="26" r="22" fill="none" stroke="#0f766e" strokeWidth="6" strokeLinecap="round" className="ob-loop ob-ring" style={style} />
      </svg>
      <div>
        <div className="text-[10px] text-muted">{label}</div>
        <div className="text-sm font-semibold text-ink">{value}</div>
      </div>
    </div>
  );
}

function DoneDemo({ t }: { t: T }) {
  return (
    <Frame>
      <div className="absolute inset-x-5 top-5 flex justify-between">
        <Ring to={0.78} label={t("demoOccupancy")} value="78%" />
        <div className="ob-loop ob-in-50 text-right">
          <div className="text-[10px] text-muted">{t("demoRevenue")}</div>
          <div className="text-sm font-semibold text-ink">MX$48,900</div>
        </div>
      </div>
      <div className="absolute inset-x-5 bottom-4 flex h-14 items-end gap-1.5">
        {[60, 85, 70, 95, 80, 100, 65].map((h, i) => (
          <div key={i} className="ob-loop ob-in-60 flex-1 rounded-t bg-[#0f766e]/80" style={{ height: `${h}%` }} />
        ))}
      </div>
    </Frame>
  );
}

export default function OnboardingDemo({ id, t }: { id: DemoId; t: T }) {
  switch (id) {
    case "you": return <YouDemo t={t} />;
    case "story": return <StoryDemo t={t} />;
    case "map": return <MapDemo t={t} />;
    case "airbnb": return <AirbnbDemo />;
    case "calendars": return <CalendarsDemo t={t} />;
    case "inbox": return <InboxDemo t={t} />;
    case "team": return <TeamDemo t={t} />;
    case "done": return <DoneDemo t={t} />;
  }
}
