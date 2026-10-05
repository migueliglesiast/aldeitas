"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-context";

export function HomeHero() {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-2 pt-4 text-center">
      <h1 className="text-balance font-poster text-[2rem] font-black leading-[1.08] tracking-tight text-heading sm:text-4xl md:text-5xl">
        {t("heroTitle")}
      </h1>
      <div className="mx-auto max-w-md pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {t("heroCompareCaption")}
        </p>
        <dl className="mt-3 grid grid-cols-2 divide-x divide-line">
          <div className="flex flex-col-reverse items-center gap-1 px-4">
            <dt className="text-sm text-muted">{t("heroThemLabel")}</dt>
            <dd className="font-poster text-3xl font-black leading-none text-muted/60 md:text-4xl">
              <span className="mr-1.5 align-middle font-sans text-sm font-medium tracking-normal">
                {t("heroThemPrefix")}
              </span>
              {t("heroThemValue")}
            </dd>
          </div>
          <div className="flex flex-col-reverse items-center gap-1 px-4">
            <dt className="text-sm font-semibold text-heading">{t("heroUsLabel")}</dt>
            <dd className="font-poster text-3xl font-black leading-none text-aldeitas md:text-4xl">
              {t("heroUsValue")}
            </dd>
          </div>
        </dl>
      </div>
      <p className="mx-auto max-w-xl text-pretty pt-1 text-base leading-7 text-muted">
        {t("heroTail")}
      </p>
    </div>
  );
}

export function HomeSignUpPrompt() {
  const { t } = useLocale();

  return (
    <div className="text-center text-sm text-muted">
      {t("newHere")}{" "}
      <Link
        className="font-semibold text-ink underline underline-offset-2 hover:text-brand"
        href="/sign-up"
      >
        {t("createAccount")}
      </Link>
    </div>
  );
}
