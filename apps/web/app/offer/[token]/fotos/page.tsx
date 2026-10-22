import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { findActiveOffer, offerPrice } from "@/lib/booking-offers";
import { prisma } from "@/lib/prisma";
import { getStorefrontFromHeaders } from "@/lib/storefront";

export const dynamic = "force-dynamic";

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function count(n: number | null | undefined, one: string, many: string) {
  if (!n) return null;
  return `${n} ${n === 1 ? one : many}`;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const offer = await findActiveOffer(token);
  return {
    title: offer ? `${offer.listing.title} · ${offer.listing.hotel.name}` : "Fotos",
    robots: { index: false, follow: false },
  };
}

/** View-only photo page for a private offer: no header, footer, links or checkout. */
export default async function OfferPhotosPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await findActiveOffer(token);
  const storefront = await getStorefrontFromHeaders();
  if (!offer || (storefront && offer.listing.hotelId !== storefront.id)) notFound();

  const listing = await prisma.listing.findUnique({
    where: { id: offer.listingId },
    select: {
      title: true,
      description: true,
      descriptionEs: true,
      guestsInBeds: true,
      numberOfBeds: true,
      numberOfBathrooms: true,
      hotel: { select: { name: true, location: true } },
      images: { orderBy: { position: "asc" }, select: { id: true, url: true } },
    },
  });
  if (!listing) notFound();

  const { nights } = offerPrice(offer);
  const description = listing.descriptionEs || listing.description;
  const facts = [
    count(nights, "noche", "noches"),
    count(listing.guestsInBeds, "huésped", "huéspedes"),
    count(listing.numberOfBeds, "cama", "camas"),
    count(listing.numberOfBathrooms, "baño", "baños"),
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:py-10">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">{listing.title}</h1>
        <p className="text-muted">
          {listing.hotel.name} · {listing.hotel.location}
        </p>
        <p className="text-sm font-semibold text-ink">
          {formatDay(offer.startDate)} → {formatDay(offer.endDate)} · {facts.join(" · ")}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {listing.images.map((img, i) => (
          <div
            key={img.id}
            className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl ${i === 0 ? "sm:col-span-2" : ""}`}
          >
            <Image
              src={img.url}
              alt={`${listing.title} ${i + 1}`}
              fill
              priority={i === 0}
              sizes={i === 0 ? "(max-width: 768px) 100vw, 768px" : "(max-width: 640px) 100vw, 384px"}
              className="object-cover"
            />
          </div>
        ))}
      </div>
      {description && <p className="whitespace-pre-line leading-relaxed text-ink/90">{description}</p>}
    </main>
  );
}
