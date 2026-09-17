import { detectLanguage, translateText } from "./auto-translate";

export type BilingualDescriptionFields = {
  description: string;
  descriptionEn: string | null;
  descriptionEs: string | null;
};

export async function syncBilingualDescription(
  text: string | null | undefined
): Promise<BilingualDescriptionFields> {
  const source = text?.trim() ?? "";
  if (!source) {
    return { description: "", descriptionEn: null, descriptionEs: null };
  }

  try {
    const language = await detectLanguage(source);

    if (language === "es") {
      const descriptionEn = await translateText(source, "en", "es");
      return {
        description: source,
        descriptionEn,
        descriptionEs: source,
      };
    }

    const descriptionEs = await translateText(source, "es", "en");
    return {
      description: source,
      descriptionEn: source,
      descriptionEs,
    };
  } catch (error) {
    console.error("[syncBilingualDescription]", error);
    return {
      description: source,
      descriptionEn: source,
      descriptionEs: source,
    };
  }
}
