"use client";

import { formatMoney } from "@/lib/currency";
import { useLocale } from "@/lib/i18n/locale-context";
import { DEFAULT_COMMISSION_PERCENT, priceSplit } from "@/lib/price-split";

type Props = {
  totalCents: number;
  currency: string;
  commissionPercent?: number;
};

export default function PriceSplit({ totalCents, currency, commissionPercent = DEFAULT_COMMISSION_PERCENT }: Props) {
  const { locale } = useLocale();
  const en = locale === "en";
  if (totalCents <= 0) return null;
  const split = priceSplit(totalCents, commissionPercent);
  const hotelPercent = 100 - split.commissionPercent;
  const money = (cents: number) => formatMoney(cents, currency);

  return (
    <div data-testid="price-split" className="space-y-1.5 rounded-xl border border-line bg-white/70 px-3 py-2.5 text-xs text-gray-600">
      <div className="flex items-center justify-between">
        <span>{en ? `Includes VAT (${split.ivaPercent}%)` : `IVA incluido (${split.ivaPercent}%)`}</span>
        <span className="tabular-nums">{money(split.ivaCents)}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
        <span className="bg-brand" style={{ width: `${hotelPercent}%` }} />
        <span className="bg-amber-400" style={{ width: `${split.commissionPercent}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
          {en ? `Goes to the hotel (${hotelPercent}%)` : `Para el hotel (${hotelPercent}%)`}
        </span>
        <span className="tabular-nums">{money(split.hotelCents)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
          {en ? `Aldeitas fee (${split.commissionPercent}%)` : `Comisión Aldeitas (${split.commissionPercent}%)`}
        </span>
        <span className="tabular-nums">{money(split.aldeitasCents)}</span>
      </div>
      <p className="text-[11px] text-muted">
        {en ? "Taxes are included in the total. No extra charges." : "Los impuestos ya están incluidos en el total. Sin cargos extra."}
      </p>
    </div>
  );
}
