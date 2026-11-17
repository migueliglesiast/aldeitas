import { describe, expect, it } from "vitest";
import { buildPerformanceRecs, buildPerformanceReport, nightKeys, type PerfStay } from "@/lib/booking-performance";
import { firstSampleCheckIn, median, occupancyShare, unavailableNights } from "@/lib/airbnb-market";

const room = (id: string, rate: number) => {
  const rates: Record<string, number> = {};
  for (let d = new Date(2026, 9, 1); d < new Date(2027, 3, 1); d.setDate(d.getDate() + 1)) {
    rates[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`] = rate;
  }
  return { id, title: id.toUpperCase(), rates };
};

const stay = (over: Partial<PerfStay>): PerfStay => ({
  id: Math.random().toString(36), listingId: "a", roomTitle: "A", channel: "aldeitas", bookedAt: "2026-11-10",
  start: "2026-11-20", end: "2026-11-22", totalCents: 210000, status: "confirmed", guestCount: 2, bookingId: null, ...over,
});

describe("buildPerformanceReport", () => {
  it("compares Aldeitas price to hotel rate + markup and payouts to the hotel rate", () => {
    const r = buildPerformanceReport({
      rooms: [room("a", 100000)],
      stays: [stay({}), stay({ channel: "airbnb", totalCents: 180000, start: "2026-11-25", end: "2026-11-27" })],
      today: "2026-11-17",
      markupPercent: 5,
    });
    const aldeitas = r.rows.find((x) => x.channel === "aldeitas")!;
    expect(aldeitas.usualNightlyCents).toBe(105000);
    expect(aldeitas.paidNightlyCents).toBe(105000);
    expect(aldeitas.deltaPct).toBe(0);
    expect(aldeitas.leadDays).toBe(10);
    const airbnb = r.rows.find((x) => x.channel === "airbnb")!;
    expect(airbnb.usualNightlyCents).toBe(100000);
    expect(airbnb.deltaPct).toBe(-10);
  });

  it("counts occupancy and bookings windows, ignoring cancelled rows", () => {
    const r = buildPerformanceReport({
      rooms: [room("a", 100000), room("b", 100000)],
      stays: [
        stay({ start: "2026-11-17", end: "2026-11-23" }),
        stay({ status: "cancelled", listingId: "b", start: "2026-11-17", end: "2026-12-17" }),
        stay({ bookedAt: "2026-10-01", listingId: "b" }),
      ],
      today: "2026-11-17",
      markupPercent: 5,
    });
    expect(r.kpis.nightsNext30).toBe(6 + 2);
    expect(r.kpis.occupancyNext30).toBeCloseTo(8 / 60);
    expect(r.kpis.bookingsLast30).toBe(1);
    expect(r.kpis.bookingsPrev30).toBe(1);
    expect(r.weekly).toHaveLength(12);
  });

  it("recommends connecting Gmail and flags no recent bookings", () => {
    const r = buildPerformanceReport({ rooms: [room("a", 1)], stays: [], today: "2026-11-17", markupPercent: 5 });
    const ids = buildPerformanceRecs(r, { gmailConnected: false, calendarsConnected: true }).map((x) => x.id);
    expect(ids).toEqual(["gmail", "nobookings"]);
  });
});

describe("airbnb market helpers", () => {
  const days = Array.from({ length: 120 }, (_, i) => {
    const d = new Date(2026, 10, 17 + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { date, available: !(i < 3 || i >= 90), availableForCheckin: i >= 10, minNights: 3 };
  });

  it("treats the closed tail of the calendar as unknown, not booked", () => {
    const strip = unavailableNights(days, "2026-11-17", 120);
    expect(strip.slice(0, 3)).toEqual([true, true, true]);
    expect(strip[100]).toBeNull();
    expect(occupancyShare(strip, 0, 30)).toBeCloseTo(3 / 30);
  });

  it("samples the first check-in at least a week out with its minimum stay", () => {
    expect(firstSampleCheckIn(days, "2026-11-17")).toEqual({ checkIn: "2026-11-27", checkOut: "2026-11-30" });
  });

  it("computes medians", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBeNull();
    expect(nightKeys("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });
});
