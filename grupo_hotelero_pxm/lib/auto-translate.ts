export type SupportedLocale = "en" | "es";

const SPANISH_HINT =
  /[áéíóúñ¿¡]|(?:\b(el|la|los|las|de|del|en|un|una|con|para|que|es|está|estudio|habitaci|alberca|playa|cocina|baño|nuestr|torre|árbol|árboles|rinconcito|disfrutar|propiedad|espacio|tranquil)\b)/i;

function heuristicLanguage(text: string): SupportedLocale {
  return SPANISH_HINT.test(text) ? "es" : "en";
}

async function googleTranslate(
  text: string,
  target: SupportedLocale,
  source: SupportedLocale | "auto" = "auto"
): Promise<{ translated: string; detected?: string }> {
  const params = new URLSearchParams({
    client: "gtx",
    sl: source,
    tl: target,
    dt: "t",
    q: text,
  });

  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Translation request failed (${response.status})`);
  }

  const data = await response.json();
  const parts = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = parts.map((part: string[]) => part?.[0] ?? "").join("");
  const detected = typeof data?.[2] === "string" ? data[2] : undefined;

  return { translated: translated || text, detected };
}

export async function detectLanguage(text: string): Promise<SupportedLocale> {
  const trimmed = text.trim();
  if (!trimmed) return "en";

  try {
    const { detected } = await googleTranslate(trimmed.slice(0, 280), "en", "auto");
    if (detected === "es" || detected === "en") return detected;
  } catch {
    // Fall back to local heuristic below.
  }

  return heuristicLanguage(trimmed);
}

export async function translateText(
  text: string,
  target: SupportedLocale,
  source?: SupportedLocale
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const chunks: string[] = [];
  const chunkSize = 450;
  for (let i = 0; i < trimmed.length; i += chunkSize) {
    chunks.push(trimmed.slice(i, i + chunkSize));
  }

  const translatedChunks: string[] = [];
  for (const chunk of chunks) {
    const { translated } = await googleTranslate(chunk, target, source ?? "auto");
    translatedChunks.push(translated);
  }

  return translatedChunks.join("").trim();
}
