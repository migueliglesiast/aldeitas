import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAirbnbDailyPriceMap, isAirbnbThrottle } from "@/lib/airbnb-prices";

function httpError(status: number) {
  return Object.assign(new Error(`status ${status}`), { isAxiosError: true, response: { status, headers: {} } });
}

describe("Airbnb price sync throttling", () => {
  afterEach(() => vi.restoreAllMocks());

  it("treats 401/403/429 as throttling", () => {
    expect(isAirbnbThrottle(httpError(429))).toBe(true);
    expect(isAirbnbThrottle(httpError(401))).toBe(true);
    expect(isAirbnbThrottle(httpError(500))).toBe(false);
    expect(isAirbnbThrottle(new Error("boom"))).toBe(false);
  });

  it("stops the whole run on the first 429 instead of retrying every day", async () => {
    const days = Array.from({ length: 30 }, (_, i) => ({
      calendarDate: `2026-11-${String(i + 1).padStart(2, "0")}`,
      available: true,
      availableForCheckin: true,
      minNights: 1,
    }));
    const calendar = { data: { data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: [{ days }] } } } } };
    const get = vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (url.includes("PdpAvailabilityCalendar")) return calendar;
      throw httpError(429);
    });
    await expect(fetchAirbnbDailyPriceMap("123", { sampleEvery: 1, delayMs: 0 })).rejects.toThrow("status 429");
    expect(get).toHaveBeenCalledTimes(2);
  });
});
