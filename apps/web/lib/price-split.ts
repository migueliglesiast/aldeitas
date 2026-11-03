export const DEFAULT_COMMISSION_PERCENT = 5;
export const LODGING_IVA_PERCENT = 16;

/** Aldeitas's cut, in cents, of a payment collected by a hotel's own account. */
export function marketplaceFeeCents(amountCents: number, percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(amountCents, Math.round((amountCents * Math.min(percent, 100)) / 100));
}

export type PriceSplit = {
  totalCents: number;
  ivaPercent: number;
  ivaCents: number;
  commissionPercent: number;
  aldeitasCents: number;
  hotelCents: number;
};

/** Splits a tax-inclusive total into the IVA it contains and the hotel / Aldeitas shares. */
export function priceSplit(
  totalCents: number,
  commissionPercent = DEFAULT_COMMISSION_PERCENT,
  ivaPercent = LODGING_IVA_PERCENT,
): PriceSplit {
  const total = Math.max(0, Math.round(totalCents));
  const iva = ivaPercent > 0 ? total - Math.round((total * 100) / (100 + ivaPercent)) : 0;
  const aldeitasCents = marketplaceFeeCents(total, commissionPercent);
  return {
    totalCents: total,
    ivaPercent,
    ivaCents: iva,
    commissionPercent,
    aldeitasCents,
    hotelCents: total - aldeitasCents,
  };
}
