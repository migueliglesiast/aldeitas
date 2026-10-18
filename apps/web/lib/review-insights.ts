import { prisma } from "@/lib/prisma";

export type ReviewTopic =
  | "cleanliness"
  | "maintenance"
  | "hotWater"
  | "cooling"
  | "wifi"
  | "noise"
  | "bugs"
  | "amenities"
  | "access"
  | "parking"
  | "accuracy"
  | "privacy";

export type ReviewCategory = "cleanliness" | "accuracy" | "checkin" | "communication" | "location" | "value";

export type ReviewInsights = {
  overall: number | null;
  reviewCount: number;
  sampleSize: number;
  hasStars: boolean;
  fiveStarShare: number | null;
  distribution: Array<{ stars: number; count: number }>;
  recentAvg: number | null;
  recentCount: number;
  priorAvg: number | null;
  categories: Array<{ key: ReviewCategory; rating: number }>;
  rooms: Array<{ title: string; overall: number | null; cleanliness: number | null; reviewCount: number }>;
  issues: Array<{ topic: ReviewTopic; mentions: number; quote: string }>;
  latest: Array<{ id: string; rating: number | null; comments: string; reviewerName: string | null; roomTitle: string; reviewedAt: string }>;
};

/** Bilingual (ES/EN) keyword lexicon; matched on accent-stripped lowercase text. */
const TOPIC_PATTERNS: Record<ReviewTopic, RegExp> = {
  cleanliness: /\b(sucio|sucia|suciedad|limpieza|(no|poco|mas|falta de) limpi|polvo|mancha|dirty|dust|stain|not (very |so )?clean|cleaning|cleanliness|smell|olor|apesta)/,
  maintenance: /\b(mantenimiento|fuga|gotea|roto|rota|descompuest|humedad|humedades|moho|desgaste|maintenance|leak|broken|damp|mold|mould|repair)/,
  hotWater: /\b(agua caliente|hot water|presion del agua|water pressure|no sube el agua|sin agua|no water)/,
  cooling: /\b(aire acondicionado|a\/c|\bac\b|ventilador|calor|caluroso|sauna|no enfria|fan|too hot|air ?con)/,
  wifi: /\b(wifi|wi-fi|internet|senal|signal)/,
  noise: /\b(ruido|ruidoso|ruidos|fiesta|noise|noisy|loud|party)/,
  bugs: /\b(mosquito|mosquitos|bicho|bichos|insecto|cucaracha|hormiga|alacran|bugs?|insects?|cockroach|ants?|scorpion)/,
  amenities: /\b(closet|closet|toalla|toallas|almohada|almohadas|sabanas|cocina|utensilio|towels?|pillows?|sheets|kitchen|hanger|gancho)/,
  access: /\b(escalera|escaleras|subida|camino|terraceria|stairs|steps|hill|path|dirt road|dificil llegar|hard to find)/,
  parking: /\b(estacionamiento|estacionar|parking|park the car)/,
  accuracy: /\b(no es como|diferente a las fotos|comunal|compartid|not as described|different from the photos|shared pool|misleading|enganos)/,
  privacy: /\b(privacidad|privacy|no (es |era )?privad|not private)/,
};

const NEGATIVE_CUE =
  /\b(no|sin|falta|faltan|faltaba|nunca|poco|poca|mal|mala|malo|problema|problemas|pero|sin embargo|aunque|solo|unicamente|necesita|deberian|not|no |without|lack|lacking|missing|never|bad|poor|problem|issue|but|however|only|needs?|could use|should)\b/;

const PRAISE_IDIOMS = /\b(sin duda|sin pensarlo|sin problemas?|no problems?|no dudes|no te arrepentiras|no issues?|no regrets?)\b/g;

const strip = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(PRAISE_IDIOMS, (m) => " ".repeat(m.length));

const QUOTE_MAX = 140;

/** Clips a long sentence to a window around `index`, keeping whole words. */
function excerpt(sentence: string, index: number) {
  if (sentence.length <= QUOTE_MAX) return sentence;
  let start = Math.max(0, index - QUOTE_MAX / 2);
  let end = Math.min(sentence.length, start + QUOTE_MAX);
  start = Math.max(0, end - QUOTE_MAX);
  if (start > 0) start = sentence.indexOf(" ", start) + 1;
  if (end < sentence.length) end = sentence.lastIndexOf(" ", end);
  return `${start > 0 ? "…" : ""}${sentence.slice(start, end).trim()}${end < sentence.length ? "…" : ""}`;
}

function sentences(text: string) {
  return text.split(/(?<=[.!?¡¿])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/** Topics a review complains about: a topic sentence counts if the review is under 5 stars or the sentence reads negative. */
export function reviewComplaints(comments: string, rating: number | null) {
  const found = new Map<ReviewTopic, string>();
  for (const sentence of sentences(comments)) {
    const plain = strip(sentence);
    const negative = (rating != null && rating <= 4) || NEGATIVE_CUE.test(plain);
    if (!negative) continue;
    for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS) as Array<[ReviewTopic, RegExp]>) {
      if (found.has(topic)) continue;
      const match = pattern.exec(plain);
      if (match) found.set(topic, excerpt(sentence, match.index));
    }
  }
  return found;
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

const CATEGORY_KEYS: ReviewCategory[] = ["cleanliness", "accuracy", "checkin", "communication", "location", "value"];

const RECENT_DAYS = 90;
const SAMPLE_DAYS = 365;

export async function getHotelReviewInsights(hotelId: string, now = new Date()): Promise<ReviewInsights | null> {
  const since = new Date(now.getTime() - SAMPLE_DAYS * 86400000);
  const listings = await prisma.listing.findMany({
    where: { hotelId },
    orderBy: { createdAt: "asc" },
    select: {
      title: true,
      ratingSummary: true,
      reviews: { where: { reviewedAt: { gte: since } }, orderBy: { reviewedAt: "desc" } },
    },
  });

  const seen = new Set<string>();
  const reviews: Array<{ id: string; rating: number | null; comments: string; reviewerName: string | null; roomTitle: string; reviewedAt: Date }> = [];
  for (const listing of listings) {
    for (const r of listing.reviews) {
      if (seen.has(r.externalId)) continue;
      seen.add(r.externalId);
      reviews.push({ id: r.externalId, rating: r.rating, comments: r.comments, reviewerName: r.reviewerName, roomTitle: listing.title, reviewedAt: r.reviewedAt });
    }
  }
  const summaries = listings.filter((l) => l.ratingSummary?.overall != null);
  if (!reviews.length && !summaries.length) return null;
  reviews.sort((a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime());

  const weighted = (pick: (s: NonNullable<(typeof listings)[number]["ratingSummary"]>) => number | null) => {
    let total = 0;
    let weight = 0;
    for (const l of summaries) {
      const value = pick(l.ratingSummary!);
      const w = l.ratingSummary!.reviewCount || 1;
      if (value == null) continue;
      total += value * w;
      weight += w;
    }
    return weight ? total / weight : null;
  };

  const rated = reviews.filter((r) => r.rating != null) as Array<(typeof reviews)[number] & { rating: number }>;
  const recentCutoff = now.getTime() - RECENT_DAYS * 86400000;
  const recent = rated.filter((r) => r.reviewedAt.getTime() >= recentCutoff);
  const prior = rated.filter((r) => r.reviewedAt.getTime() < recentCutoff);

  const issueMap = new Map<ReviewTopic, { mentions: number; quote: string }>();
  for (const review of reviews) {
    for (const [topic, quote] of reviewComplaints(review.comments, review.rating)) {
      const entry = issueMap.get(topic);
      if (entry) entry.mentions += 1;
      else issueMap.set(topic, { mentions: 1, quote });
    }
  }

  const categories = CATEGORY_KEYS.map((key) => ({ key, rating: weighted((s) => s[key]) }))
    .filter((c): c is { key: ReviewCategory; rating: number } => c.rating != null)
    .sort((a, b) => a.rating - b.rating);

  const listingSummaryCount = summaries.reduce((s, l) => s + (l.ratingSummary!.reviewCount || 0), 0);

  return {
    overall: weighted((s) => s.overall) ?? avg(rated.map((r) => r.rating)),
    reviewCount: Math.max(listingSummaryCount, reviews.length),
    sampleSize: reviews.length,
    hasStars: rated.length > 0,
    fiveStarShare: rated.length ? rated.filter((r) => r.rating === 5).length / rated.length : null,
    distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: rated.filter((r) => r.rating === stars).length })),
    recentAvg: avg(recent.map((r) => r.rating)),
    recentCount: recent.length,
    priorAvg: avg(prior.map((r) => r.rating)),
    categories,
    rooms: listings
      .filter((l) => l.ratingSummary?.overall != null || l.reviews.length)
      .map((l) => ({
        title: l.title,
        overall: l.ratingSummary?.overall ?? avg(l.reviews.flatMap((r) => (r.rating != null ? [r.rating] : []))),
        cleanliness: l.ratingSummary?.cleanliness ?? null,
        reviewCount: l.ratingSummary?.reviewCount ?? l.reviews.length,
      }))
      .sort((a, b) => (a.overall ?? 6) - (b.overall ?? 6)),
    issues: [...issueMap.entries()]
      .map(([topic, v]) => ({ topic, ...v }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 4),
    latest: reviews.slice(0, 3).map((r) => ({ ...r, reviewedAt: r.reviewedAt.toISOString() })),
  };
}
