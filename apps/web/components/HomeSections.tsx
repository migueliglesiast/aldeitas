"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";
import type { MessageKey } from "@/lib/i18n/messages";

export const FAQ_ITEMS: Array<{ q: MessageKey; a: MessageKey }> = [
  { q: "faq1Q", a: "faq1A" },
  { q: "faq2Q", a: "faq2A" },
  { q: "faq3Q", a: "faq3A" },
  { q: "faq4Q", a: "faq4A" },
  { q: "faq5Q", a: "faq5A" },
  { q: "faq6Q", a: "faq6A" },
];

const ICONS = {
  search: "M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z",
  card: "M3 7h18v10H3zM3 11h18M7 15h3",
  check: "M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zm4 9l2 2 4-4",
  lock: "M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z",
  home: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5",
  chat: "M4 5h16v11H8l-4 4V5z",
} as const;

function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name]} />
    </svg>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-aldeitas">{eyebrow}</p>
      <h2 className="font-poster text-2xl font-black tracking-tight text-heading md:text-3xl">{title}</h2>
    </div>
  );
}

export function StaysHeading({ hotels, rooms }: { hotels: number; rooms: number }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <SectionHeading eyebrow={t("staysEyebrow")} title={t("staysTitle")} />
      <p className="text-sm text-muted">{t("staysCount", { hotels, rooms })}</p>
    </div>
  );
}

export function HowItWorks() {
  const { t } = useLocale();
  const steps: Array<{ icon: keyof typeof ICONS; title: MessageKey; body: MessageKey }> = [
    { icon: "search", title: "howStep1Title", body: "howStep1Body" },
    { icon: "card", title: "howStep2Title", body: "howStep2Body" },
    { icon: "check", title: "howStep3Title", body: "howStep3Body" },
  ];
  const trust: Array<{ icon: keyof typeof ICONS; title: MessageKey; body: MessageKey }> = [
    { icon: "lock", title: "trustPaymentTitle", body: "trustPaymentBody" },
    { icon: "home", title: "trustLocalTitle", body: "trustLocalBody" },
    { icon: "chat", title: "trustSupportTitle", body: "trustSupportBody" },
  ];

  return (
    <section id="how" className="scroll-mt-36 space-y-8">
      <SectionHeading eyebrow={t("howEyebrow")} title={t("howTitle")} />
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-3xl border border-line/80 bg-card p-6 shadow-pill">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-aldeitas/10 text-aldeitas">
                <Icon name={step.icon} />
              </span>
              <span className="font-poster text-sm font-black tabular-nums text-muted">0{i + 1}</span>
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-heading">{t(step.title)}</h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">{t(step.body)}</p>
          </li>
        ))}
      </ol>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-line/70 pt-8 md:grid-cols-3">
        {trust.map((item) => (
          <li key={item.title} className="flex gap-3">
            <Icon name={item.icon} className="mt-0.5 h-5 w-5 shrink-0 text-aldeitas" />
            <div>
              <p className="text-sm font-semibold text-heading">{t(item.title)}</p>
              <p className="mt-0.5 text-sm leading-6 text-muted">{t(item.body)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FaqList({ items = FAQ_ITEMS }: { items?: typeof FAQ_ITEMS }) {
  const { t } = useLocale();
  return (
    <div className="divide-y divide-line/80 rounded-3xl border border-line/80 bg-card shadow-pill">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-1 md:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-heading [&::-webkit-details-marker]:hidden">
            {t(item.q)}
            <svg
              className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-45"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          </summary>
          <p className="pb-5 pr-8 text-sm leading-6 text-muted">{t(item.a)}</p>
        </details>
      ))}
    </div>
  );
}

export function HomeFaq() {
  const { t } = useLocale();
  return (
    <section id="faq" className="scroll-mt-36 grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="space-y-4">
        <SectionHeading eyebrow={t("faqEyebrow")} title={t("faqTitle")} />
        <Link
          href="/ayuda"
          className="inline-flex items-center gap-1 text-sm font-semibold text-ink underline underline-offset-4 hover:text-aldeitas"
        >
          {t("faqSeeAll")} <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="lg:col-span-2">
        <FaqList items={FAQ_ITEMS.slice(0, 4)} />
      </div>
    </section>
  );
}

export function HostBand() {
  const { t } = useLocale();
  return (
    <section className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-line/80 bg-surface px-6 py-8 md:flex-row md:items-center md:px-10">
      <div className="space-y-1">
        <h2 className="font-poster text-xl font-black tracking-tight text-heading md:text-2xl">{t("hostBandTitle")}</h2>
        <p className="text-muted">{t("hostBandBody")}</p>
      </div>
      <Link
        href="/sign-up"
        className="shrink-0 rounded-full bg-heading px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink"
      >
        {t("hostBandCta")}
      </Link>
    </section>
  );
}
