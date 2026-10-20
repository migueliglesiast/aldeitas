import type { GuestAnswer } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const STOPWORDS = new Set(
  "el la los las un una de del y o que en es por para con mi me se lo al como cual cuál hay the a an of and or is are to for in on my me what how where when do does can i you".split(" ")
);

const SYNONYMS = new Map<string, string>([
  ["internet", "wifi"],
  ["wi-fi", "wifi"],
  ["contrasena", "wifi"],
  ["clave", "wifi"],
  ["red", "wifi"],
  ["checkout", "salida"],
  ["check-out", "salida"],
  ["checkin", "llegada"],
  ["check-in", "llegada"],
  ["rules", "reglas"],
  ["estacionamiento", "parking"],
  ["toallas", "towels"],
  ["password", "wifi"],
]);

export function tokens(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map((w) => SYNONYMS.get(w) ?? w);
}

export async function answersFor(hotelId: string | null, listingId: string | null) {
  if (!hotelId) return [];
  const rows = await prisma.guestAnswer.findMany({ where: { hotelId }, orderBy: { createdAt: "asc" } });
  return rows.filter((a) => !a.listingId || a.listingId === listingId);
}

/** Keyword fallback used when no LLM is reachable. */
export function bestKeywordMatch(question: string, answers: GuestAnswer[]) {
  const q = new Set(tokens(question));
  let best: { answer: GuestAnswer; score: number } | null = null;
  for (const answer of answers) {
    const words = new Set(tokens(answer.question));
    let hits = 0;
    for (const w of words) if (q.has(w)) hits += 1;
    const score = words.size ? hits / words.size : 0;
    if (hits > 0 && (!best || score > best.score)) best = { answer, score };
  }
  return best && best.score >= 0.5 ? best.answer : null;
}
