"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";
import type { MessageKey } from "@/lib/i18n/messages";
import { CONTACT_EMAIL } from "@/lib/site";

const COLUMNS: Array<{ title: MessageKey; links: Array<{ href: string; label: MessageKey }> }> = [
  {
    title: "footerExplore",
    links: [
      { href: "/#stays", label: "navStays" },
      { href: "/#how", label: "navHowItWorks" },
      { href: "/#faq", label: "faqTitle" },
    ],
  },
  {
    title: "footerHosts",
    links: [
      { href: "/sign-up", label: "footerListPlace" },
      { href: "/sign-in", label: "hostPortal" },
    ],
  },
  {
    title: "footerSupport",
    links: [
      { href: "/ayuda", label: "footerHelp" },
      { href: "/terminos", label: "footerTerms" },
      { href: "/privacidad", label: "footerPrivacy" },
    ],
  },
];

export default function PortalFooter() {
  const { t } = useLocale();

  return (
    <footer className="mt-24 border-t border-line/60 bg-surface">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 md:grid-cols-5 md:px-6">
        <div className="col-span-2 space-y-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/aldeitas_logo.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className="font-poster text-2xl font-black leading-none tracking-tight text-aldeitas">
              Aldeitas
            </span>
          </Link>
          <p className="max-w-xs text-sm leading-6 text-muted">{t("footerAbout")}</p>
          <div className="space-y-1.5 text-sm text-muted">
            <p className="flex items-center gap-2">
              <svg className="h-4 w-4 text-aldeitas" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-5.6-7-11a7 7 0 1114 0c0 5.4-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {t("footerLocation")}
            </p>
            <p className="flex items-center gap-2">
              <svg className="h-4 w-4 text-aldeitas" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4zM4 7l8 6 8-6" />
              </svg>
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={t(col.title)} className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-heading">{t(col.title)}</p>
            <ul className="space-y-2 text-sm text-muted">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-ink hover:underline">
                    {t(link.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line/60">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center md:px-6">
          <p>
            © {new Date().getFullYear()} Aldeitas · {t("footerRights")}
          </p>
          <p className="flex items-center gap-2">
            {t("footerPaymentsBy")}
            <Image
              src="/images/mercadopago-logo.png"
              alt="Mercado Pago"
              width={353}
              height={143}
              className="h-5 w-auto rounded-sm"
            />
          </p>
        </div>
      </div>
    </footer>
  );
}
