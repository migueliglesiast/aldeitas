"use client";

import { useLocale } from "@/lib/i18n/locale-context";

export function HomeHero() {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-2 pt-4 text-center">
      <h1 className="text-balance font-poster text-[2rem] font-black leading-[1.08] tracking-tight text-heading sm:text-4xl md:text-5xl">
        {t("heroTitle")}
      </h1>
      <div className="mx-auto max-w-md pt-3">
        <p className="flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-heading/80">
          <span aria-hidden className="h-px w-8 bg-heading/20" />
          {t("heroCompareCaption")}
          <span aria-hidden className="h-px w-8 bg-heading/20" />
        </p>
        <dl className="mt-4 grid grid-cols-2 divide-x divide-heading/15">
          <div className="flex flex-col-reverse items-center gap-1.5 px-2 sm:px-4">
            <dt className="whitespace-nowrap text-sm font-medium text-muted">{t("heroThemLabel")}</dt>
            <dd className="font-poster text-4xl font-black leading-none tabular-nums text-muted md:text-5xl">
              <span className="mr-1.5 align-middle font-sans text-sm font-medium tracking-normal">
                {t("heroThemPrefix")}
              </span>
              {t("heroThemValue")}
            </dd>
          </div>
          <div className="flex flex-col-reverse items-center gap-1.5 px-2 sm:px-4">
            <dt className="whitespace-nowrap text-sm font-semibold text-heading">{t("heroUsLabel")}</dt>
            <dd className="font-poster text-4xl font-black leading-none tabular-nums text-aldeitas md:text-5xl">
              {t("heroUsValue")}
            </dd>
          </div>
        </dl>
      </div>
      <p className="mx-auto max-w-xl text-pretty pt-2 text-base leading-7 text-heading/80">
        {t("heroTail")}
      </p>
    </div>
  );
}
