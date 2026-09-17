"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import type { Locale } from "@/lib/i18n/messages";

function FlagButton({
  locale,
  active,
  label,
  flag,
  onSelect,
}: {
  locale: Locale;
  active: boolean;
  label: string;
  flag: string;
  onSelect: (locale: Locale) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(locale)}
      aria-label={label}
      aria-pressed={active}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-full border text-lg transition-all",
        active
          ? "border-[#00a19c] bg-white shadow-sm ring-2 ring-[#00a19c]/25"
          : "border-gray-200 bg-white/80 hover:border-gray-300 hover:bg-white",
      ].join(" ")}
    >
      <span aria-hidden>{flag}</span>
    </button>
  );
}

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="flex items-center gap-2">
      <FlagButton
        locale="en"
        active={locale === "en"}
        label={t("switchToEnglish")}
        flag="🇺🇸"
        onSelect={setLocale}
      />
      <FlagButton
        locale="es"
        active={locale === "es"}
        label={t("switchToSpanish")}
        flag="🇲🇽"
        onSelect={setLocale}
      />
    </div>
  );
}
