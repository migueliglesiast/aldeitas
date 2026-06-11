"use client";

import { useLocale } from "@/lib/i18n/locale-context";

export default function MapLoadingPlaceholder() {
  const { t } = useLocale();

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#e8f6f5] to-[#faf3e8] text-sm text-[#4a7c78]">
      {t("loadingMap")}
    </div>
  );
}
