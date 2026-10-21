import type { HotelAddon } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addonLineTotal, addonUnit } from "@/lib/addon-units";

export { ADDON_UNITS, ADDON_UNIT_LABELS, addonLineTotal, addonUnit, type AddonUnit } from "@/lib/addon-units";

export type AddonSelection = { addonId: string; quantity: number };

export type PricedAddon = {
  addonId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export function publicAddon(addon: HotelAddon) {
  return {
    id: addon.id,
    name: addon.name,
    nameEn: addon.nameEn,
    description: addon.description,
    emoji: addon.emoji,
    priceCents: addon.priceCents,
    currency: addon.currency,
    unit: addonUnit(addon.unit),
    maxQuantity: addon.maxQuantity,
  };
}

export async function listEnabledAddons(hotelId: string) {
  return prisma.hotelAddon.findMany({
    where: { hotelId, enabled: true, priceCents: { gt: 0 } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Units of a stock-limited add-on already promised to other live bookings overlapping the stay. */
async function reservedUnits(addonId: string, startDate: Date, endDate: Date) {
  const rows = await prisma.bookingAddon.findMany({
    where: {
      addonId,
      booking: {
        status: { not: "CANCELED" },
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
    },
    select: { quantity: true },
  });
  return rows.reduce((sum, row) => sum + row.quantity, 0);
}

export class AddonError extends Error {}

/** Validates a guest's add-on picks against the hotel catalog and stock, and prices them. */
export async function priceAddonSelection(
  hotelId: string,
  currency: string,
  selection: AddonSelection[],
  startDate: Date,
  endDate: Date,
  nights: number
): Promise<PricedAddon[]> {
  const picks = selection.filter((item) => item.quantity > 0);
  if (picks.length === 0) return [];
  const ids = [...new Set(picks.map((item) => item.addonId))];
  if (ids.length !== picks.length) throw new AddonError("Duplicate add-on");
  const addons = await prisma.hotelAddon.findMany({
    where: { id: { in: ids }, hotelId, enabled: true, priceCents: { gt: 0 } },
  });
  const byId = new Map(addons.map((addon) => [addon.id, addon]));
  const priced: PricedAddon[] = [];
  for (const pick of picks) {
    const addon = byId.get(pick.addonId);
    if (!addon) throw new AddonError("Add-on not available");
    if (addon.currency !== currency) throw new AddonError("Add-on currency mismatch");
    if (pick.quantity > addon.maxQuantity) throw new AddonError(`Too many: ${addon.name}`);
    if (addon.stock !== null) {
      const left = addon.stock - (await reservedUnits(addon.id, startDate, endDate));
      if (pick.quantity > left) throw new AddonError(`Sold out for those dates: ${addon.name}`);
    }
    priced.push({
      addonId: addon.id,
      name: addon.name,
      unit: addonUnit(addon.unit),
      quantity: pick.quantity,
      unitPriceCents: addon.priceCents,
      totalCents: addonLineTotal(addon, pick.quantity, nights),
    });
  }
  return priced;
}
