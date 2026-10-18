import { describe, it, expect } from "vitest";
import { computeHotelStats } from "@/lib/hotel-stats";
import type { HotelCalendarPayload } from "@/lib/hotel-calendar-data";

const days = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);

function payload(): HotelCalendarPayload {
  const cells = Object.fromEntries(
    days.map((d) => [d, { status: "available" as const, priceCents: 200000, priceOverride: false }])
  );
  return {
    hotel: { id: "h", name: "H", location: "P" },
    startDate: days[0],
    endDate: days[9],
    days,
    readOnly: true,
    rooms: [
      {
        id: "r1",
        title: "Room 1",
        nightlyBasePrice: 200000,
        baseCurrency: "MXN",
        cells,
        spans: [
          {
            id: "a",
            kind: "external",
            source: "airbnb",
            label: "External",
            startDay: "2026-11-02",
            endDay: "2026-11-03",
            rangeStartDay: "2026-11-02",
            checkoutDay: "2026-11-04",
            dayCount: 2,
            guestName: "Ana",
            payoutCents: 400000,
            payoutCurrency: "MXN",
          },
          {
            id: "v",
            kind: "external",
            source: "vrbo",
            label: "External",
            startDay: "2026-11-06",
            endDay: "2026-11-07",
            rangeStartDay: "2026-11-06",
            checkoutDay: "2026-11-08",
            dayCount: 2,
            guestName: "Lauren (Vrbo)",
            payoutCents: 10000,
            payoutCurrency: "USD",
          },
          {
            id: "g",
            kind: "ghost",
            source: "ghost",
            label: "Ghost",
            startDay: "2026-11-09",
            endDay: "2026-11-09",
            rangeStartDay: "2026-11-09",
            checkoutDay: "2026-11-10",
            dayCount: 1,
            guestName: "Ghost",
          },
        ],
      },
      {
        id: "r2",
        title: "Room 2",
        nightlyBasePrice: 100000,
        baseCurrency: "MXN",
        cells,
        spans: [
          {
            id: "b",
            kind: "manual_block",
            source: "blocked",
            label: "Blocked",
            startDay: "2026-11-05",
            endDay: "2026-11-06",
            rangeStartDay: "2026-11-05",
            checkoutDay: "2026-11-07",
            dayCount: 2,
          },
        ],
      },
    ],
  };
}

describe("computeHotelStats", () => {
  it("counts occupied nights, converts USD payouts and excludes blocks and ghosts", () => {
    const stats = computeHotelStats(payload(), "2026-11-05", 20);
    // Past window (Nov 1–4): 2 occupied of 4 nights × 2 rooms.
    expect(stats.kpis.occupancyPast30).toBeCloseTo(2 / 8);
    // Next window (Nov 5–10): 2 Vrbo nights of 6 × 2 rooms.
    expect(stats.kpis.occupancyNext30).toBeCloseTo(2 / 12);
    expect(stats.kpis.revenuePast30Cents).toBe(400000);
    expect(stats.kpis.revenueNext90Cents).toBe(200000);
    expect(stats.kpis.adrCents).toBe(150000);
    expect(stats.kpis.blockedNightsNext30).toBe(2);
    expect(stats.kpis.ghostNights).toBe(1);
    expect(stats.sources).toEqual([{ source: "vrbo", nights: 2 }]);
    expect(stats.arrivals.map((a) => a.guestName)).toEqual(["Lauren (Vrbo)"]);
    expect(stats.departures).toHaveLength(1);
    expect(stats.rooms[0].listedRateCents).toBe(200000);
    expect(stats.next7.map((d) => d.occupied)).toEqual([0, 1, 1, 0, 0, 0]);
    expect(stats.kpis.revenueNext7Cents).toBe(200000);
    expect(stats.revenueBySource).toEqual([
      { source: "airbnb", past30Cents: 400000, next90Cents: 0 },
      { source: "vrbo", past30Cents: 0, next90Cents: 200000 },
    ]);
    expect(stats.payoutCoverage).toEqual({ withPayout: 2, total: 2 });
  });
});
