"use client";

import { useLocale } from "@/lib/i18n/locale-context";

/** Inline bilingual text for server-rendered admin pages. */
export default function AdminText({ es, en }: { es: string; en: string }) {
  return <>{useLocale().locale === "es" ? es : en}</>;
}
