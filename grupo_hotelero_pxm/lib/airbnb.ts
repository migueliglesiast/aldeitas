import axios from "axios";
import ical from "node-ical";
import * as cheerio from "cheerio";

export type AvailabilityBlock = {
  start: Date;
  end: Date;
  summary?: string;
  description?: string;
  uid?: string;
};

export async function fetchIcalBlocks(icalUrl: string): Promise<AvailabilityBlock[]> {
  const data = await axios.get(icalUrl).then((r) => r.data as string);
  const events = ical.parseICS(data);
  const blocks: AvailabilityBlock[] = [];
  for (const key of Object.keys(events)) {
    const ev = events[key];
    if (ev.type === "VEVENT") {
      blocks.push({
        start: ev.start as Date,
        end: ev.end as Date,
        summary: typeof ev.summary === "string" ? ev.summary : undefined,
        description:
          typeof ev.description === "string" ? ev.description : undefined,
        uid: typeof ev.uid === "string" ? ev.uid : undefined,
      });
    }
  }
  return blocks;
}

const LISTING_PHOTO_RE =
  /https:\/\/a0\.muscache\.com\/im\/pictures\/[^"'\\]+?\/original\/[^"'\\?]+/g;

const BLOCKED_PHOTO_PATTERNS = [
  /airbnbplatformassets/i,
  /\/im\/pictures\/user\//i,
  /review-ai-synthesis/i,
];

/** True for listing gallery photos; false for icons, host avatars, UI assets, etc. */
export function isListingPhotoUrl(url: string): boolean {
  const normalized = url.split("?")[0];
  if (!normalized.includes("muscache.com/im/pictures")) return false;
  if (BLOCKED_PHOTO_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  return /\/im\/pictures\/(?:miso\/|hosting\/)/i.test(normalized);
}

function normalizePhotoUrl(url: string) {
  return url.split("?")[0];
}

function collectListingPhotoUrls(urls: Iterable<string>) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const raw of urls) {
    const url = normalizePhotoUrl(raw);
    if (!isListingPhotoUrl(url) || seen.has(url)) continue;
    seen.add(url);
    ordered.push(url);
  }

  return ordered;
}

function extractListingPhotoUrls(html: string): string[] {
  const matches = html.match(LISTING_PHOTO_RE) ?? [];
  return collectListingPhotoUrls(matches);
}

export function normalizeAirbnbListingUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Airbnb listing URL is required");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("Please enter a valid Airbnb listing URL");
  }

  if (!url.hostname.includes("airbnb.")) {
    throw new Error("Please enter a valid Airbnb listing URL");
  }

  return url.toString();
}

const AIRBNB_FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
};

function decodeAirbnbJsonString(raw: string) {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchListingPageHtml(airbnbUrl: string): Promise<string> {
  const normalizedUrl = normalizeAirbnbListingUrl(airbnbUrl);
  const { data } = await axios.get(normalizedUrl, {
    headers: AIRBNB_FETCH_HEADERS,
    maxRedirects: 5,
  });
  return data as string;
}

export function scrapeListingDescription(html: string): string | null {
  const htmlTextMatch = html.match(
    /"htmlDescription"\s*:\s*\{[\s\S]*?"htmlText"\s*:\s*"((?:\\.|[^"\\])*)"/
  );
  if (htmlTextMatch?.[1]) {
    const text = htmlToPlainText(decodeAirbnbJsonString(htmlTextMatch[1]));
    if (text.length > 0) return text;
  }

  const ogMatch = html.match(
    /property="og:description"\s+content="([^"]+)"/i
  );
  if (ogMatch?.[1]) {
    const text = htmlToPlainText(
      ogMatch[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    );
    if (text.length > 0) return text;
  }

  return null;
}

export function scrapeListingImagesFromHtml(html: string): string[] {
  const fromJson = extractListingPhotoUrls(html);
  if (fromJson.length > 0) return fromJson.slice(0, 30);

  const $ = cheerio.load(html);
  const fallbackUrls: string[] = [];
  $("img").each((_, img) => {
    const src = $(img).attr("src");
    const altSrc = $(img).attr("data-src");
    for (const candidate of [src, altSrc]) {
      if (candidate) fallbackUrls.push(candidate);
    }
  });

  return collectListingPhotoUrls(fallbackUrls).slice(0, 30);
}

export async function scrapeListingImages(airbnbUrl: string): Promise<string[]> {
  const html = await fetchListingPageHtml(airbnbUrl);
  return scrapeListingImagesFromHtml(html);
}

export async function scrapeListingContent(airbnbUrl: string) {
  const normalizedUrl = normalizeAirbnbListingUrl(airbnbUrl);
  const html = await fetchListingPageHtml(normalizedUrl);
  return {
    airbnbUrl: normalizedUrl,
    images: scrapeListingImagesFromHtml(html),
    description: scrapeListingDescription(html),
  };
}

export async function fetchDynamicPricing(airbnbId: string, checkIn: string, checkOut: string) {
  // Prefer Airbnb's public GraphQL pricing (same source guests see on the listing).
  try {
    const { fetchAirbnbStayPrice } = await import("@/lib/airbnb-prices");
    const { extractAirbnbListingId } = await import("@/lib/airbnb-listing-id");
    const listingId = extractAirbnbListingId(airbnbId);
    if (listingId) {
      const stay = await fetchAirbnbStayPrice(listingId, checkIn, checkOut);
      if (stay) {
        return { nightlyCents: stay.nightlyCents, currency: stay.currency };
      }
    }
  } catch {
    // fall through to RapidAPI
  }

  // Optional RapidAPI fallback when configured
  try {
    const apiKey = process.env.AIRBNB_RAPIDAPI_KEY;
    if (apiKey) {
      const resp = await axios.get(
        "https://airbnb13.p.rapidapi.com/calendar",
        {
          params: { room_id: airbnbId, checkin: checkIn, checkout: checkOut, currency: "MXN" },
          headers: {
            "x-rapidapi-key": apiKey,
            "x-rapidapi-host": "airbnb13.p.rapidapi.com",
          },
          timeout: 8000,
        }
      );
      const data = resp.data as any;
      const nightly = data?.nights?.[0]?.price?.total || data?.price || data?.price_total || null;
      if (nightly) {
        const amount = Number(nightly);
        if (!Number.isNaN(amount) && amount > 0) {
          return { nightlyCents: Math.round(amount * 100), currency: data?.currency || "MXN" };
        }
      }
    }
  } catch {
    // ignore and fall back
  }
  return null as { nightlyCents: number; currency: string } | null;
}
