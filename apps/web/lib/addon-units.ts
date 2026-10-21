export const ADDON_UNITS = ["item", "night", "person"] as const;
export type AddonUnit = (typeof ADDON_UNITS)[number];

export const ADDON_UNIT_LABELS: Record<AddonUnit, { es: string; en: string }> = {
  item: { es: "por pieza", en: "each" },
  night: { es: "por noche", en: "per night" },
  person: { es: "por persona", en: "per person" },
};

export const ADDON_KINDS = ["standard", "early_checkin", "late_checkout"] as const;
export type AddonKind = (typeof ADDON_KINDS)[number];

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

export function describeBookingAddonLine(item: { name: string; unit: string; quantity: number }, nights: number) {
  const unit = addonUnit(item.unit);
  if (unit === "night") return `${item.name} × ${item.quantity} · ${nights} ${nights === 1 ? "noche" : "noches"}`;
  if (unit === "person") return `${item.name} × ${item.quantity} ${item.quantity === 1 ? "persona" : "personas"}`;
  return `${item.name} × ${item.quantity}`;
}
