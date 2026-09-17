"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import { getLocalizedDescription } from "@/lib/i18n/localized-description";

type LocalizedText = {
  description?: string | null;
  descriptionEn?: string | null;
  descriptionEs?: string | null;
};

type Props = {
  item: LocalizedText;
  className?: string;
};

export default function LocalizedDescription({ item, className = "" }: Props) {
  const { locale } = useLocale();
  const text = getLocalizedDescription(item, locale);

  if (!text) return null;

  return <p className={`whitespace-pre-line text-gray-700 ${className}`.trim()}>{text}</p>;
}
