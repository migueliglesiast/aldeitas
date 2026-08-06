import axios from "axios";
import ical from "node-ical";
import * as cheerio from "cheerio";
import { assertSafeUrl, MAX_RESPONSE_BYTES, REQUEST_TIMEOUT_MS } from "./safe-url";

export type AvailabilityBlock = { start: Date; end: Date };

const MAX_REDIRECTS = 3;

/**
 * Fetches a URL following redirects manually so that every hop is revalidated
 * against the SSRF allowlist before it is requested.
 */
async function fetchSafely(rawUrl: string, headers?: Record<string, string>): Promise<string> {
  let target = assertSafeUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await axios.get(target.toString(), {
      timeout: REQUEST_TIMEOUT_MS,
      maxContentLength: MAX_RESPONSE_BYTES,
      maxBodyLength: MAX_RESPONSE_BYTES,
      maxRedirects: 0,
      responseType: "text",
      headers,
      validateStatus: (status) => (status >= 200 && status < 300) || (status >= 300 && status < 400),
    });

    if (response.status < 300) return response.data as string;

    const location = response.headers?.location as string | undefined;
    if (!location) throw new Error("Redirect without a location header");
    const next = assertSafeUrl(new URL(location, target).toString());
    if (next.host !== target.host) {
      // Never replay per-host headers on another host.
      headers = undefined;
    }
    target = next;
  }

  throw new Error("Too many redirects");
}

export async function fetchIcalBlocks(icalUrl: string): Promise<AvailabilityBlock[]> {
  const data = await fetchSafely(icalUrl);
  const events = ical.parseICS(data);
  const blocks: AvailabilityBlock[] = [];
  for (const key of Object.keys(events)) {
    const ev = events[key];
    if (ev?.type === "VEVENT") {
      blocks.push({ start: ev.start as Date, end: ev.end as Date });
    }
  }
  return blocks;
}

export async function scrapeListingImages(airbnbUrl: string): Promise<string[]> {
  const data = await fetchSafely(airbnbUrl, {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  });
  const $ = cheerio.load(data);
  const urls = new Set<string>();
  $("img").each((_, img) => {
    const src = $(img).attr("src");
    const altSrc = $(img).attr("data-src");
    for (const u of [src, altSrc]) {
      if (u && /airbnb|muscache/.test(u)) urls.add(u.split("?")[0]);
    }
  });
  return Array.from(urls).slice(0, 12);
}

export async function fetchDynamicPricing(airbnbId: string, checkIn: string, checkOut: string) {
  // Best-effort RapidAPI integration (if key provided)
  try {
    const apiKey = process.env.AIRBNB_RAPIDAPI_KEY;
    if (apiKey) {
      const resp = await axios.get(
        "https://airbnb13.p.rapidapi.com/calendar",
        {
          params: { room_id: airbnbId, checkin: checkIn, checkout: checkOut, currency: "USD" },
          headers: {
            "x-rapidapi-key": apiKey,
            "x-rapidapi-host": "airbnb13.p.rapidapi.com",
          },
          timeout: 8000,
          maxContentLength: MAX_RESPONSE_BYTES,
          maxBodyLength: MAX_RESPONSE_BYTES,
        }
      );
      const data = resp.data as {
        nights?: Array<{ price?: { total?: number } }>;
        price?: number;
        price_total?: number;
        currency?: string;
      };
      const nightly = data?.nights?.[0]?.price?.total || data?.price || data?.price_total || null;
      if (nightly) {
        const amount = Number(nightly);
        if (!Number.isNaN(amount) && amount > 0) {
          return { nightlyCents: Math.round(amount * 100), currency: data?.currency || "USD" };
        }
      }
    }
  } catch {
    // ignore and fall back
  }
  return null as { nightlyCents: number; currency: string } | null;
}
