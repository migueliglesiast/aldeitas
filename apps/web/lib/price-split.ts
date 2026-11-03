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

/** Airbnb's guest-facing nightly price is treated as including IVA; Aldeitas strips it to get the hotel's rate. */
export const AIRBNB_GUEST_TAX_PERCENT = 16;
/** Aldeitas adds its commission on top of the hotel's rate to get the price guests see. */
export const GUEST_MARKUP_PERCENT = DEFAULT_COMMISSION_PERCENT;

/** Hotel rate from the nightly price a guest sees on Airbnb: minus 16%. */
export function hotelRateFromAirbnbCents(airbnbGuestCents: number) {
  return Math.round((airbnbGuestCents * (100 - AIRBNB_GUEST_TAX_PERCENT)) / 100);
}

/** Price an Aldeitas guest pays for a hotel-set rate: plus 5%. */
export function guestPriceCents(hotelRateCents: number) {
  return Math.round((hotelRateCents * (100 + GUEST_MARKUP_PERCENT)) / 100);
}

/** Aldeitas guest price from Airbnb's guest-facing price: minus 16%, then plus 5%. */
export function guestPriceFromAirbnbCents(airbnbGuestCents: number) {
  return guestPriceCents(hotelRateFromAirbnbCents(airbnbGuestCents));
}
