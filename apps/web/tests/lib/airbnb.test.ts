import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const axiosGet = vi.fn();
const parseICS = vi.fn();

vi.mock("axios", () => ({ default: { get: (...args: unknown[]) => axiosGet(...args) } }));
vi.mock("node-ical", () => ({ default: { parseICS: (...args: unknown[]) => parseICS(...args) } }));

const { fetchIcalBlocks, scrapeListingImages, fetchDynamicPricing } = await import("@/lib/airbnb");

const ICAL_URL = "https://www.airbnb.com/calendar/ical/1.ics";

describe("fetchIcalBlocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns start/end pairs for VEVENT entries only", async () => {
    axiosGet.mockResolvedValue({ data: "ICS" });
    const start = new Date("2025-01-01");
    const end = new Date("2025-01-03");
    parseICS.mockReturnValue({
      a: { type: "VEVENT", start, end },
      b: { type: "VTIMEZONE" },
    });

    await expect(fetchIcalBlocks(ICAL_URL)).resolves.toEqual([{ start, end }]);
    expect(axiosGet).toHaveBeenCalledWith(
      ICAL_URL,
      expect.objectContaining({ timeout: expect.any(Number), maxRedirects: 0 })
    );
  });

  it("refuses unsafe URLs before making a request", async () => {
    await expect(fetchIcalBlocks("http://www.airbnb.com/x.ics")).rejects.toThrow(/https/);
    await expect(fetchIcalBlocks("https://169.254.169.254/x")).rejects.toThrow(/not allowed/);
    await expect(fetchIcalBlocks("https://evil.com/x.ics")).rejects.toThrow(/allowlist/);
    expect(axiosGet).not.toHaveBeenCalled();
  });
});

describe("scrapeListingImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collects airbnb/muscache image urls without query strings, capped at 12", async () => {
    const many = Array.from(
      { length: 15 },
      (_, i) => `<img src="https://a0.muscache.com/p${i}.jpg?size=large" />`
    ).join("");
    axiosGet.mockResolvedValue({
      data: `<html><body>${many}<img data-src="https://a0.muscache.com/data.jpg" /><img src="https://other.com/x.jpg" /></body></html>`,
    });

    const urls = await scrapeListingImages("https://www.airbnb.com/rooms/1");

    expect(urls).toHaveLength(12);
    expect(urls[0]).toBe("https://a0.muscache.com/p0.jpg");
    expect(urls.some((u) => u.includes("other.com"))).toBe(false);
  });

  it("refuses unsafe URLs before making a request", async () => {
    await expect(scrapeListingImages("https://localhost/rooms/1")).rejects.toThrow(/not allowed/);
    expect(axiosGet).not.toHaveBeenCalled();
  });
});

describe("fetchDynamicPricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AIRBNB_RAPIDAPI_KEY;
  });

  afterEach(() => {
    delete process.env.AIRBNB_RAPIDAPI_KEY;
  });

  it("returns null when no API key is configured", async () => {
    await expect(fetchDynamicPricing("1", "2025-01-01", "2025-01-03")).resolves.toBeNull();
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it("converts the nightly price to cents", async () => {
    process.env.AIRBNB_RAPIDAPI_KEY = "key";
    axiosGet.mockResolvedValue({
      data: { nights: [{ price: { total: 123.45 } }], currency: "MXN" },
    });

    await expect(fetchDynamicPricing("1", "2025-01-01", "2025-01-03")).resolves.toEqual({
      nightlyCents: 12345,
      currency: "MXN",
    });
  });

  it("defaults the currency to USD and reads fallback price fields", async () => {
    process.env.AIRBNB_RAPIDAPI_KEY = "key";
    axiosGet.mockResolvedValue({ data: { price_total: 50 } });

    await expect(fetchDynamicPricing("1", "2025-01-01", "2025-01-03")).resolves.toEqual({
      nightlyCents: 5000,
      currency: "USD",
    });
  });

  it("returns null for unusable payloads and on request failure", async () => {
    process.env.AIRBNB_RAPIDAPI_KEY = "key";
    axiosGet.mockResolvedValueOnce({ data: {} });
    await expect(fetchDynamicPricing("1", "2025-01-01", "2025-01-03")).resolves.toBeNull();

    axiosGet.mockResolvedValueOnce({ data: { price: "not-a-number" } });
    await expect(fetchDynamicPricing("1", "2025-01-01", "2025-01-03")).resolves.toBeNull();

    axiosGet.mockRejectedValueOnce(new Error("network"));
    await expect(fetchDynamicPricing("1", "2025-01-01", "2025-01-03")).resolves.toBeNull();
  });
});
