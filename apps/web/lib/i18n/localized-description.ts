import type { Locale } from "./messages";

type LocalizedText = {
  description?: string | null;
  descriptionEn?: string | null;
  descriptionEs?: string | null;
};

export function getLocalizedDescription(
  item: LocalizedText,
  locale: Locale
): string | null {
  const text =
    locale === "en"
      ? item.descriptionEn ?? item.description
      : item.descriptionEs ?? item.description;

  return text?.trim() ? text : null;
}
