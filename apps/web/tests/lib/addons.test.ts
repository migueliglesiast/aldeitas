import { describe, expect, it } from "vitest";
import { addonLineTotal, addonUnit, addonUnitPriceCents, describeBookingAddonLine, paidByProvider, parseAddonOptions, rentalDayCount } from "@/lib/addon-units";
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

describe("provider add-ons", () => {
  it("parses vehicle options and ignores malformed JSON", () => {
    expect(parseAddonOptions('[{"name":"ATV","priceCents":85000}]')).toEqual([{ name: "ATV", priceCents: 85000 }]);
    expect(parseAddonOptions("not json")).toEqual([]);
    expect(parseAddonOptions(null)).toEqual([]);
  });

  it("counts rental days inclusively and prices them per day", () => {
    expect(rentalDayCount("2026-11-14", "2026-11-15")).toBe(2);
    expect(addonLineTotal({ priceCents: 85000, unit: "night" }, 1, rentalDayCount("2026-11-14", "2026-11-15"))).toBe(170000);
  });

  it("describes the chosen vehicle and its rental days", () => {
    const line = describeBookingAddonLine(
      { name: "Renta de moto", unit: "night", quantity: 1, option: "ATV", rentalStart: new Date("2026-11-14"), rentalEnd: new Date("2026-11-16") },
      5
    );
    expect(line).toBe("Renta de moto (ATV) × 1 · 3 días");
  });

  it("only third-party extras are paid to a provider", () => {
    expect(paidByProvider("standard")).toBe(true);
    expect(paidByProvider("early_checkin")).toBe(false);
  });

  it("requires a valid provider WhatsApp from the admin", () => {
    const base = { name: "Moto", priceCents: 50000, unit: "night", maxQuantity: 2, enabled: true };
    expect(addonInputSchema.safeParse({ ...base, providerPhone: "+52 954 123 4567" }).success).toBe(true);
    expect(addonInputSchema.safeParse({ ...base, providerPhone: "call me" }).success).toBe(false);
    expect(addonInputSchema.parse({ ...base, providerPhone: "", options: [{ name: "ATV", priceCents: 85000 }] })).toMatchObject({
      providerPhone: null,
      options: '[{"name":"ATV","priceCents":85000}]',
    });
  });
});
