import type { HotelAddon } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addonLineTotal,
  addonUnit,
  addonUnitPriceCents,
  paidByProvider,
  parseAddonOptions,
  rentalDayCount,
  type AddonKind,
} from "@/lib/addon-units";

export { ADDON_UNITS, ADDON_UNIT_LABELS, addonLineTotal, addonUnit, addonUnitPriceCents, type AddonUnit } from "@/lib/addon-units";

export type AddonSelection = { addonId: string; quantity: number; option?: string; from?: string; to?: string };

export type PricedAddon = {
  addonId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  option: string | null;
  rentalStart: Date | null;
  rentalEnd: Date | null;
  depositCents: number;
  paidTo: "hotel" | "provider";
  providerName: string | null;
  providerPhone: string | null;
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
    options: parseAddonOptions(addon.options),
    depositCents: addon.depositCents,
    note: addon.note,
    paidToProvider: paidByProvider(addon.kind),
    providerName: paidByProvider(addon.kind) ? addon.providerName : null,
  };
}

export function adminAddon(addon: HotelAddon) {
  return { ...addon, options: parseAddonOptions(addon.options) };
}

const PRICED = { OR: [{ priceCents: { gt: 0 } }, { nightPercent: { gt: 0 } }] };
const OFFERABLE = {
  AND: [PRICED, { OR: [{ kind: { not: "standard" } }, { providerName: { not: null }, providerPhone: { not: null } }] }],
};
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

/** Add-ons an owner hand-picked for a private offer; provider details are not required for these. */
export async function offerAddonCatalog(hotelId: string, listingId: string, startDate: Date, endDate: Date, ids: string[]) {
  const [addons, blocked] = await Promise.all([
    prisma.hotelAddon.findMany({
      where: { id: { in: ids }, hotelId, enabled: true, ...PRICED },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    unavailableTurnoverKinds(listingId, startDate, endDate),
  ]);
  return addons.filter((addon) => !blocked.has(addon.kind as AddonKind));
}

export async function listEnabledAddons(hotelId: string) {
  return prisma.hotelAddon.findMany({
    where: { hotelId, enabled: true, ...OFFERABLE },
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

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A continuous run of stay days, `to` inclusive; the last usable day is the one before check-out. */
function rentalRange(from: string, to: string, startDate: Date, endDate: Date) {
  if (!DAY.test(from) || !DAY.test(to)) return false;
  const start = new Date(from);
  const end = new Date(to);
  if (start < startDate || end < start || end.getTime() > endDate.getTime() - DAY_MS) return false;
  return { start, end };
}

/** Card charge for the stay: provider-paid extras are settled with the provider, not on the card. */
export function hotelChargedCents(addons: PricedAddon[]) {
  return addons.filter((item) => item.paidTo === "hotel").reduce((sum, item) => sum + item.totalCents, 0);
}

async function assertInStock(addon: HotelAddon, quantity: number, startDate: Date, endDate: Date) {
  if (addon.stock === null) return;
  const left = addon.stock - (await reservedUnits(addon.id, startDate, endDate));
  if (quantity > left) throw new AddonError(`Sold out for those dates: ${addon.name}`);
}

/** Validates a guest's add-on picks against the hotel catalog and stock, and prices them. */
export async function priceAddonSelection(
  stay: { hotelId: string; listingId: string; currency: string; startDate: Date; endDate: Date; nights: number; nightlyCents: number },
  selection: AddonSelection[],
  /** Restricts picks to an offer's hand-picked add-ons (which skip the provider-details rule). */
  allowedIds?: string[]
): Promise<PricedAddon[]> {
  const { hotelId, listingId, currency, startDate, endDate, nights, nightlyCents } = stay;
  const picks = selection.filter((item) => item.quantity > 0);
  if (picks.length === 0) return [];
  const ids = [...new Set(picks.map((item) => item.addonId))];
  if (ids.length !== picks.length) throw new AddonError("Duplicate add-on");
  if (allowedIds && ids.some((id) => !allowedIds.includes(id))) throw new AddonError("Add-on not available");
  const addons = await prisma.hotelAddon.findMany({
    where: { id: { in: ids }, hotelId, enabled: true, ...(allowedIds ? PRICED : OFFERABLE) },
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
    const options = parseAddonOptions(addon.options);
    const option = options.length > 0 ? options.find((item) => item.name === pick.option) : null;
    if (option === undefined) throw new AddonError(`Choose an option: ${addon.name}`);
    const rental = addonUnit(addon.unit) === "night" && pick.from && pick.to ? rentalRange(pick.from, pick.to, startDate, endDate) : null;
    if (rental === false) throw new AddonError(`Rental days must fall within the stay: ${addon.name}`);
    const unitPriceCents = option ? option.priceCents : addonUnitPriceCents(addon, nightlyCents);
    const days = rental ? rentalDayCount(rental.start, rental.end) : nights;
    const provider = paidByProvider(addon.kind);
    priced.push({
      addonId: addon.id,
      name: addon.name,
      unit: addonUnit(addon.unit),
      quantity: pick.quantity,
      unitPriceCents,
      totalCents: addonLineTotal({ unit: addon.unit, priceCents: unitPriceCents }, pick.quantity, days),
      option: option ? option.name : null,
      rentalStart: rental ? rental.start : null,
      rentalEnd: rental ? rental.end : null,
      depositCents: (addon.depositCents ?? 0) * pick.quantity,
      paidTo: provider ? "provider" : "hotel",
      providerName: provider ? addon.providerName : null,
      providerPhone: provider ? addon.providerPhone : null,
    });
  }
  return priced;
}
