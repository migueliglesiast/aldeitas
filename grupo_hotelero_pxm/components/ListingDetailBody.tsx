"use client";

import Link from "next/link";
import ListingImageGallery from "@/components/ListingImageGallery";
import BookingForm from "@/components/BookingForm";
import LocalizedDescription from "@/components/LocalizedDescription";
import { useLocale } from "@/lib/i18n/locale-context";

type Props = {
  listing: {
    id: string;
    title: string;
    description: string | null;
    descriptionEn: string | null;
    descriptionEs: string | null;
    nightlyBasePrice: number;
    baseCurrency: string;
    hotel: {
      id: string;
      location: string;
    };
    images: Array<{ id: string; url: string; position: number }>;
  };
};

export default function ListingDetailBody({ listing }: Props) {
  const { t } = useLocale();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/hotel/${listing.hotel.id}`}
          className="inline-flex items-center gap-2 rounded px-3 py-2 text-white bg-[#00a19c] transition-colors duration-200 hover:bg-[#008a86]"
        >
          {t("back")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <ListingImageGallery images={listing.images} title={listing.title} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{listing.title}</h1>
            <p className="text-gray-600">{listing.hotel.location}</p>
          </div>
        </div>
        <div className="space-y-4">
          <LocalizedDescription
            item={listing}
            className="rounded-lg border border-gray-200 bg-white/90 p-4 text-sm leading-relaxed"
          />
          <BookingForm
            listingId={listing.id}
            basePriceCents={listing.nightlyBasePrice}
            currency={listing.baseCurrency}
          />
        </div>
      </div>
    </div>
  );
}
