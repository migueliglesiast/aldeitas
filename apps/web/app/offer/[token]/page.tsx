import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import BookingForm from "@/components/BookingForm";
import { publicAddon } from "@/lib/addons";
import { findActiveOffer, listOfferAddons, offerDateKeys, offerPrice } from "@/lib/booking-offers";
import { getStorefrontFromHeaders } from "@/lib/storefront";
import { getPortalOrigin } from "@/lib/storefront-host";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await findActiveOffer(token);
  if (!offer) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        <h1 className="font-display text-xl font-bold text-ink">Este enlace ya no está disponible</h1>
        <p className="mt-2 text-sm text-muted">This booking link has expired. Escríbenos para otra fecha.</p>
      </div>
    );
  }

  const storefront = await getStorefrontFromHeaders();
  if (storefront && offer.listing.hotelId !== storefront.id) {
    redirect(`${getPortalOrigin()}/offer/${offer.token}`);
  }

  const { listing } = offer;
  const price = offerPrice(offer);
  const addons = (await listOfferAddons(offer)).map(publicAddon);
  const cover = listing.images[0];

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-3">
        {cover && (
          <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
            <Image src={cover.url} alt={listing.title} fill sizes="80px" className="object-cover" priority />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold leading-tight text-ink">{listing.title}</h1>
          <p className="text-sm text-muted">
            {listing.hotel.name} · {formatDay(offer.startDate)} → {formatDay(offer.endDate)}
          </p>
          {offer.guestName && <p className="text-xs text-muted">Para {offer.guestName}</p>}
        </div>
      </div>
      <div id="checkout">
        <BookingForm
          listingId={listing.id}
          basePriceCents={offer.nightlyCents}
          currency={offer.currency}
          offer={{
            token: offer.token,
            ...offerDateKeys(offer),
            nights: price.nights,
            nightlyCents: offer.nightlyCents,
            cleaningFeeCents: offer.cleaningFeeCents,
            discountPercent: offer.discountPercent,
            discountCents: price.discountCents,
            totalCents: price.totalCents,
            addons,
          }}
        />
      </div>
    </div>
  );
}
