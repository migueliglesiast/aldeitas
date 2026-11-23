import { describe, expect, it } from "vitest";
import { buildHostInsights, countOrphanGaps } from "@/lib/host-insights";
import type { HotelStats } from "@/lib/hotel-stats";

function stats(over: Partial<HotelStats["kpis"]> = {}, rooms: Partial<HotelStats["rooms"][number]>[] = []): HotelStats {
  return {
    todayKey: "2026-11-02",
    currency: "MXN",
    usdToMxn: 18.5,
    roomCount: rooms.length || 1,
    kpis: {
      occupancyNext7: 0.6,
      revenueNext7Cents: 0,
      occupancyNext30: 0.6,
      occupancyPast30: 0.6,
      revenuePast30Cents: 0,
      revenueNext90Cents: 0,
      adrCents: null,
      revparNext30Cents: 0,
      avgStayNights: null,
      blockedNightsNext30: 0,
      ghostNights: 0,
      ...over,
    },
    timeline: [],
    next7: [],
    revenueBySource: [],
    payoutCoverage: { withPayout: 0, total: 0 },
    months: [],
    sources: [],
    rooms: rooms.map((r, i) => ({
      id: `r${i}`,
      title: `Room ${i}`,
      occupancyPast30: 0,
      occupancyNext30: 0,
      nightsNext90: 0,
      revenueNext90Cents: 0,
      listedRateCents: null,
      next30Strip: "o".repeat(30),
      ...r,
    })),
    arrivals: [],
    departures: [],
  };
}

describe("countOrphanGaps", () => {
  it("counts 1–2 night holes between stays only", () => {
    expect(countOrphanGaps("oofoo")).toBe(1);
    expect(countOrphanGaps("ooffoo")).toBe(1);
    expect(countOrphanGaps("oofffoo")).toBe(0);
    expect(countOrphanGaps("ffoo")).toBe(0);
    expect(countOrphanGaps("ofofo")).toBe(2);
  });
});

describe("buildHostInsights", () => {
  it("says all good when nothing stands out", () => {
    expect(buildHostInsights(stats({}, [{}])).map((i) => i.id)).toEqual(["all-good"]);
  });

  it("flags slow weeks, pace drops, gaps and empty rooms, urgent first", () => {
    const ids = buildHostInsights(
      stats({ occupancyNext7: 0.2, occupancyPast30: 0.8, occupancyNext30: 0.3 }, [
        { next30Strip: "oofoo" + "o".repeat(25) },
        { title: "Empty", next30Strip: "f".repeat(30) },
      ]),
      2
    ).map((i) => i.id);
    expect(ids.slice(0, 2)).toEqual(["onboarding", "slow-week"]);
    expect(ids).toEqual(expect.arrayContaining(["pace-drop", "orphan-gaps", "empty-rooms", "weekends"]));
  });

  it("suggests raising prices when nearly full", () => {
    expect(buildHostInsights(stats({ occupancyNext30: 0.9 }, [{}])).map((i) => i.id)).toContain("raise-prices");
  });
});
