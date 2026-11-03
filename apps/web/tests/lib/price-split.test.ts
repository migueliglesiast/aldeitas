import { describe, expect, it } from "vitest";
import { guestPriceCents, guestPriceFromAirbnbCents, hotelRateFromAirbnbCents, priceSplit } from "@/lib/price-split";

describe("priceSplit", () => {
  it("splits MX$50 into 5% for Aldeitas and 95% for the hotel, with IVA included", () => {
    expect(priceSplit(5000)).toEqual({
      totalCents: 5000,
      ivaPercent: 16,
      ivaCents: 690,
      commissionPercent: 5,
      aldeitasCents: 250,
      hotelCents: 4750,
    });
  });

  it("always adds back up to the total", () => {
    for (const total of [1, 999, 170100, 1234567]) {
      const s = priceSplit(total);
      expect(s.hotelCents + s.aldeitasCents).toBe(total);
    }
  });

  it("supports a per-hotel commission and no tax", () => {
    const s = priceSplit(10000, 0, 0);
    expect(s).toMatchObject({ aldeitasCents: 0, hotelCents: 10000, ivaCents: 0 });
  });
});

describe("guest pricing", () => {
  it("Airbnb guest price: minus 16%, then plus 5%", () => {
    expect(hotelRateFromAirbnbCents(100000)).toBe(84000);
    expect(guestPriceFromAirbnbCents(100000)).toBe(88200);
  });

  it("hotel-set rate: plus 5%", () => {
    expect(guestPriceCents(100000)).toBe(105000);
  });
});
