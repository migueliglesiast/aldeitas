import type { HotelAddon } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addonLineTotal, addonUnit, addonUnitPriceCents, type AddonKind } from "@/lib/addon-units";

export { ADDON_UNITS, ADDON_UNIT_LABELS, addonLineTotal, addonUnit, addonUnitPriceCents, type AddonUnit } from "@/lib/addon-units";

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
    nightPercent: addon.nightPercent,
  };
}

const PRICED = [{ priceCents: { gt: 0 } }, { nightPercent: { gt: 0 } }];
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

function sameDay(date: Date) {
  return { gte: new Date(date.getTime() - HALF_DAY_MS), lt: new Date(date.getTime() + HALF_DAY_MS) };
}

/**
 * Early check-in and late check-out share the same 1 pm turnover slot: early check-in is off when the
 * guest leaving that room on arrival day bought late check-out, and late check-out is off when the
 * guest arriving on departure day bought early check-in.
 */
export async function unavailableTurnoverKinds(listingId: string, startDate: Date, endDate: Date) {
  const live = { listingId, status: { not: "CANCELED" as const } };
  const [lateBefore, earlyAfter] = await Promise.all([
    prisma.bookingAddon.count({
      where: { addon: { kind: "late_checkout" }, booking: { ...live, endDate: sameDay(startDate) } },
    }),
    prisma.bookingAddon.count({
      where: { addon: { kind: "early_checkin" }, booking: { ...live, startDate: sameDay(endDate) } },
    }),
  ]);
  const blocked = new Set<AddonKind>();
  if (lateBefore > 0) blocked.add("early_checkin");
  if (earlyAfter > 0) blocked.add("late_checkout");
  return blocked;
}

/** Enabled add-ons a guest can pick for this room and stay; turnover extras need dates. */
export async function listOfferedAddons(hotelId: string, listingId: string, startDate: Date | null, endDate: Date | null) {
  const addons = await listEnabledAddons(hotelId);
  const blocked = startDate && endDate ? await unavailableTurnoverKinds(listingId, startDate, endDate) : null;
  return addons.filter((addon) => addon.kind === "standard" || (blocked !== null && !blocked.has(addon.kind as AddonKind)));
}

export async function listEnabledAddons(hotelId: string) {
  return prisma.hotelAddon.findMany({
    where: { hotelId, enabled: true, OR: PRICED },
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

async function assertInStock(addon: HotelAddon, quantity: number, startDate: Date, endDate: Date) {
  if (addon.stock === null) return;
  const left = addon.stock - (await reservedUnits(addon.id, startDate, endDate));
  if (quantity > left) throw new AddonError(`Sold out for those dates: ${addon.name}`);
}

/** Validates a guest's add-on picks against the hotel catalog and stock, and prices them. */
export async function priceAddonSelection(
  stay: { hotelId: string; listingId: string; currency: string; startDate: Date; endDate: Date; nights: number; nightlyCents: number },
  selection: AddonSelection[]
): Promise<PricedAddon[]> {
  const { hotelId, listingId, currency, startDate, endDate, nights, nightlyCents } = stay;
  const picks = selection.filter((item) => item.quantity > 0);
  if (picks.length === 0) return [];
  const ids = [...new Set(picks.map((item) => item.addonId))];
  if (ids.length !== picks.length) throw new AddonError("Duplicate add-on");
  const addons = await prisma.hotelAddon.findMany({
    where: { id: { in: ids }, hotelId, enabled: true, OR: PRICED },
  });
  const blocked = addons.some((addon) => addon.kind !== "standard")
    ? await unavailableTurnoverKinds(listingId, startDate, endDate)
    : new Set<AddonKind>();
  const byId = new Map(addons.map((addon) => [addon.id, addon]));
  const priced: PricedAddon[] = [];
  for (const pick of picks) {
    const addon = byId.get(pick.addonId);
    if (!addon) throw new AddonError("Add-on not available");
    if (addon.currency !== currency) throw new AddonError("Add-on currency mismatch");
    if (pick.quantity > addon.maxQuantity) throw new AddonError(`Too many: ${addon.name}`);
    if (blocked.has(addon.kind as AddonKind)) throw new AddonError(`Not available for those dates: ${addon.name}`);
    await assertInStock(addon, pick.quantity, startDate, endDate);
    priced.push({
      addonId: addon.id,
      name: addon.name,
      unit: addonUnit(addon.unit),
      quantity: pick.quantity,
      unitPriceCents: addonUnitPriceCents(addon, nightlyCents),
      totalCents: addonLineTotal({ unit: addon.unit, priceCents: addonUnitPriceCents(addon, nightlyCents) }, pick.quantity, nights),
    });
  }
  return priced;
}
