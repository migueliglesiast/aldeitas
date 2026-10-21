import { z } from "zod";

export const ADDON_UNITS = ["item", "night", "person"] as const;
export type AddonUnit = (typeof ADDON_UNITS)[number];

export const ADDON_UNIT_LABELS: Record<AddonUnit, { es: string; en: string }> = {
  item: { es: "por pieza", en: "each" },
  night: { es: "por día", en: "per day" },
  person: { es: "por persona", en: "per person" },
};

export const ADDON_KINDS = ["standard", "early_checkin", "late_checkout"] as const;
export type AddonKind = (typeof ADDON_KINDS)[number];

export const addonOptionsSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(40),
      nameEn: z.string().trim().max(40).nullable().optional(),
      priceCents: z.number().int().min(1).max(100_000_00),
    })
  )
  .max(8);
export type AddonOption = z.infer<typeof addonOptionsSchema>[number];

export function parseAddonOptions(raw: string | null | undefined): AddonOption[] {
  if (!raw) return [];
  try {
    const parsed = addonOptionsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Third-party extras (motos, beer, tours…) are paid to their provider; turnover extras are the hotel's own. */
export function paidByProvider(kind: string) {
  return kind === "standard";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Inclusive day count of a rental from `from` to `to` (yyyy-mm-dd or Date). */
export function rentalDayCount(from: string | Date, to: string | Date) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS) + 1;
}

/** Price of one unit; add-ons with `nightPercent` cost that share of the stay's nightly rate. */
export function addonUnitPriceCents(
  addon: { priceCents: number; nightPercent?: number | null },
  nightlyCents: number
) {
  return addon.nightPercent ? Math.round((nightlyCents * addon.nightPercent) / 100) : addon.priceCents;
}

export function addonUnit(unit: string): AddonUnit {
  return (ADDON_UNITS as readonly string[]).includes(unit) ? (unit as AddonUnit) : "item";
}

export function addonLineTotal(addon: { priceCents: number; unit: string }, quantity: number, nights: number) {
  const multiplier = addonUnit(addon.unit) === "night" ? Math.max(1, nights) : 1;
  return addon.priceCents * quantity * multiplier;
}

export function describeBookingAddonLine(
  item: { name: string; unit: string; quantity: number; option?: string | null; rentalStart?: Date | null; rentalEnd?: Date | null },
  nights: number
) {
  const unit = addonUnit(item.unit);
  const name = item.option ? `${item.name} (${item.option})` : item.name;
  if (unit === "night" && item.rentalStart && item.rentalEnd) {
    const days = rentalDayCount(item.rentalStart, item.rentalEnd);
    return `${name} × ${item.quantity} · ${days} ${days === 1 ? "día" : "días"}`;
  }
  if (unit === "night") return `${name} × ${item.quantity} · ${nights} ${nights === 1 ? "noche" : "noches"}`;
  if (unit === "person") return `${name} × ${item.quantity} ${item.quantity === 1 ? "persona" : "personas"}`;
  return `${name} × ${item.quantity}`;
}
