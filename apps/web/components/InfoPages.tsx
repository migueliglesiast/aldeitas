"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FaqList } from "@/components/HomeSections";
import { useLocale } from "@/lib/i18n/locale-context";
import { LEGAL_UPDATED, legalContent, type LegalDoc } from "@/lib/i18n/legal";
import { CONTACT_EMAIL } from "@/lib/site";

function PageShell({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-3xl space-y-10 pt-4">
      <div className="space-y-3">
        <Link href="/" className="text-sm font-medium text-muted hover:text-ink hover:underline">
          {t("back")}
        </Link>
        <h1 className="font-poster text-3xl font-black tracking-tight text-heading md:text-4xl">{title}</h1>
        {lead ? <p className="text-muted">{lead}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function HelpContent() {
  const { t } = useLocale();
  return (
    <PageShell title={t("helpTitle")} lead={t("helpLead")}>
      <FaqList />
      <section id="contact" className="space-y-3 rounded-3xl border border-line/80 bg-surface p-6 md:p-8">
        <h2 className="font-poster text-xl font-black tracking-tight text-heading">{t("contactTitle")}</h2>
        <p className="text-sm leading-6 text-muted">{t("contactBody")}</p>
        <p className="text-sm">
          <span className="text-muted">{t("contactEmailLabel")}: </span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline underline-offset-4 hover:text-aldeitas">
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </PageShell>
  );
}

export function LegalContent({ doc }: { doc: LegalDoc }) {
  const { t, locale, dateLocale } = useLocale();
  const sections = legalContent(doc, locale, CONTACT_EMAIL);
  const updated = new Date(`${LEGAL_UPDATED}T12:00:00Z`).toLocaleDateString(dateLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <PageShell
      title={t(doc === "terms" ? "termsTitle" : "privacyTitle")}
      lead={t("lastUpdated", { date: updated })}
    >
      <div className="space-y-8">
        {sections.map((section, i) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="font-display text-lg font-bold text-heading">
              {i + 1}. {section.heading}
            </h2>
            {section.body.map((p) => (
              <p key={p} className="leading-7 text-ink">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </PageShell>
  );
}
