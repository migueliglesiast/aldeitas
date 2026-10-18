import axios from "axios";

const AIRBNB_API_KEY = process.env.AIRBNB_API_KEY || "d306zoyjsyarp7ifhu67rjxn52tv0t20";

/** Public persisted-query hashes used by Airbnb's web client (may rotate). */
const REVIEWS_HASH =
  process.env.AIRBNB_REVIEWS_HASH ||
  "2ed951bfedf71b87d9d30e24a419e15517af9fbed7ac560a8d1cc7feadfa22e6";
const STAYS_PDP_SECTIONS_HASH =
  process.env.AIRBNB_STAYS_PDP_HASH ||
  "80c7889b4b0027d99ffea830f6c0d4911a6e863a957cbe1044823f0fc746bf1f";

export type AirbnbReview = {
  externalId: string;
  rating: number | null;
  comments: string;
  language: string | null;
  reviewerName: string | null;
  reviewedAt: Date;
};

export type AirbnbRatingSummary = {
  overall: number | null;
  reviewCount: number | null;
  cleanliness: number | null;
  accuracy: number | null;
  checkin: number | null;
  communication: number | null;
  location: number | null;
  value: number | null;
};

const CATEGORY_FIELDS = {
  CLEANLINESS: "cleanliness",
  ACCURACY: "accuracy",
  CHECKIN: "checkin",
  COMMUNICATION: "communication",
  LOCATION: "location",
  VALUE: "value",
} as const;

type CategoryField = (typeof CATEGORY_FIELDS)[keyof typeof CATEGORY_FIELDS];

function headers() {
  return {
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Airbnb-Api-Key": AIRBNB_API_KEY,
  };
}

function stayListingId(airbnbId: string) {
  return Buffer.from(`StayListing:${airbnbId}`).toString("base64");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" };

export function cleanReviewText(raw: string) {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, name: string) => ENTITIES[name] ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type RawReview = {
  id?: string;
  rating?: number | null;
  comments?: string | null;
  language?: string | null;
  createdAt?: string | null;
  reviewer?: { firstName?: string | null } | null;
};

export async function fetchAirbnbReviews(airbnbId: string, limit = 24): Promise<AirbnbReview[]> {
  const variables = {
    id: stayListingId(airbnbId),
    pdpReviewsRequest: {
      fieldSelector: "for_p3_translation_only",
      forPreview: false,
      limit,
      first: limit,
      offset: "0",
      showingTranslationButton: false,
      sortingPreference: "MOST_RECENT",
    },
  };
  const params = new URLSearchParams({
    operationName: "StaysPdpReviewsQuery",
    locale: "es-MX",
    currency: "MXN",
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: REVIEWS_HASH } }),
  });
  const res = await axios.get(`https://www.airbnb.mx/api/v3/StaysPdpReviewsQuery/${REVIEWS_HASH}?${params}`, {
    headers: headers(),
    timeout: 20000,
  });
  if (res.data?.errors?.length) throw new Error(res.data.errors[0]?.message || "Airbnb reviews query failed");
  const raw: RawReview[] = res.data?.data?.presentation?.stayProductDetailPage?.reviews?.reviews || [];
  return raw
    .filter((r) => r.id && r.createdAt)
    .map((r) => ({
      externalId: String(r.id),
      rating: typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5 ? Math.round(r.rating) : null,
      comments: cleanReviewText(r.comments || ""),
      language: r.language || null,
      reviewerName: r.reviewer?.firstName || null,
      reviewedAt: new Date(String(r.createdAt)),
    }));
}

type RawCategory = { categoryType?: string; localizedRating?: string };

function collectRatings(node: unknown, out: { overall: number | null; count: number | null; categories: Map<string, number> }) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectRatings(item, out);
    return;
  }
  const record = node as Record<string, unknown>;
  const category = record as RawCategory;
  if (typeof category.categoryType === "string" && category.localizedRating !== undefined) {
    const n = toNumber(category.localizedRating);
    if (n != null) out.categories.set(category.categoryType, n);
  }
  if (out.overall == null && record.overallRating !== undefined) out.overall = toNumber(record.overallRating);
  if (out.count == null && record.overallCount !== undefined) out.count = toNumber(record.overallCount);
  for (const value of Object.values(record)) collectRatings(value, out);
}

export async function fetchAirbnbRatingSummary(airbnbId: string): Promise<AirbnbRatingSummary> {
  const variables = {
    id: stayListingId(airbnbId),
    pdpSectionsRequest: {
      adults: "1",
      layouts: ["SIDEBAR", "SINGLE_COLUMN"],
      sectionIds: ["REVIEWS_DEFAULT"],
      useNewSectionWrapperApi: false,
    },
  };
  const params = new URLSearchParams({
    operationName: "StaysPdpSections",
    locale: "es-MX",
    currency: "MXN",
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: STAYS_PDP_SECTIONS_HASH } }),
  });
  const res = await axios.get(`https://www.airbnb.mx/api/v3/StaysPdpSections/${STAYS_PDP_SECTIONS_HASH}?${params}`, {
    headers: headers(),
    timeout: 20000,
  });
  if (res.data?.errors?.length) throw new Error(res.data.errors[0]?.message || "Airbnb rating query failed");
  const out = { overall: null as number | null, count: null as number | null, categories: new Map<string, number>() };
  collectRatings(res.data?.data, out);
  const summary: AirbnbRatingSummary = {
    overall: out.overall,
    reviewCount: out.count != null ? Math.round(out.count) : null,
    cleanliness: null,
    accuracy: null,
    checkin: null,
    communication: null,
    location: null,
    value: null,
  };
  for (const [type, field] of Object.entries(CATEGORY_FIELDS) as Array<[string, CategoryField]>) {
    summary[field] = out.categories.get(type) ?? null;
  }
  return summary;
}
