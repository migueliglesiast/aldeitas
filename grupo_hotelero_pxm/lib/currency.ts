export const SITE_CURRENCY = "MXN";

const MXN_LOCALE = "es-MX";

export function formatMoney(
  amountCents: number,
  currency: string = SITE_CURRENCY,
  options?: { maximumFractionDigits?: number; locale?: string }
) {
  return new Intl.NumberFormat(options?.locale ?? MXN_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    minimumFractionDigits: options?.maximumFractionDigits === 0 ? 0 : undefined,
  }).format(amountCents / 100);
}

export function formatMoneyShort(amountCents: number, currency: string = SITE_CURRENCY) {
  return formatMoney(amountCents, currency, { maximumFractionDigits: 0 });
}
