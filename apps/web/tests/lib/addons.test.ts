import { describe, expect, it } from "vitest";
import { addonLineTotal, addonUnit, addonUnitPriceCents, describeBookingAddonLine } from "@/lib/addon-units";
import { addonInputSchema } from "@/lib/addon-admin";

describe("add-on pricing", () => {
  it("multiplies per-night add-ons by the stay length only", () => {
    expect(addonLineTotal({ priceCents: 60000, unit: "night" }, 2, 3)).toBe(360000);
    expect(addonLineTotal({ priceCents: 25000, unit: "item" }, 2, 3)).toBe(50000);
    expect(addonLineTotal({ priceCents: 50000, unit: "person" }, 4, 3)).toBe(200000);
  });

  it("prices percent-of-night add-ons from the stay's nightly rate", () => {
    expect(addonUnitPriceCents({ priceCents: 0, nightPercent: 20 }, 150000)).toBe(30000);
    expect(addonUnitPriceCents({ priceCents: 25000, nightPercent: null }, 150000)).toBe(25000);
  });

  it("falls back to per-item for unknown units", () => {
    expect(addonUnit("weird")).toBe("item");
  });

  it("describes booked add-ons in Spanish", () => {
    expect(describeBookingAddonLine({ name: "Moto", unit: "night", quantity: 1 }, 2)).toBe("Moto × 1 · 2 noches");
    expect(describeBookingAddonLine({ name: "Pulsera", unit: "person", quantity: 2 }, 2)).toBe("Pulsera × 2 personas");
  });

  it("rejects negative prices and unknown units from the admin", () => {
    const base = { name: "Cerveza", priceCents: 25000, unit: "item", maxQuantity: 5, enabled: true };
    expect(addonInputSchema.safeParse(base).success).toBe(true);
    expect(addonInputSchema.safeParse({ ...base, priceCents: -1 }).success).toBe(false);
    expect(addonInputSchema.safeParse({ ...base, unit: "hour" }).success).toBe(false);
  });
});
