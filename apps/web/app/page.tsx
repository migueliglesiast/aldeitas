import Link from "next/link";
import { getHotelsWithListings, type HotelWithListings } from "@/lib/data";
import HotelGrid from "@/components/HotelGrid";
import SearchForm from "@/components/SearchForm";

// Make homepage dynamic to ensure it works at runtime
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const hotels: HotelWithListings[] = await getHotelsWithListings();
  // Order hotels exactly as requested
  const desiredOrder = [
    "Aldeita Mixteca",
    "La Otra Aldeita",
    "La Arbolita",
    "Nido Escondido",
    "Casa Yahua",
    "Casa Guadalupe",
    "Casa Oaxira",
    "Coco By-The-Beach",
    "Ranchito Zicatela",
    "Espacio Malinxhe",
  ];
  const orderMap = new Map(desiredOrder.map((n, i) => [n, i]));
  const sorted = [...hotels].sort((a, b) => {
    const ai = orderMap.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const bi = orderMap.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  const serializedHotels = sorted.map((h) => ({
    id: h.id,
    name: h.name,
    description: h.description,
    location: h.location,
    googleMapsUrl: h.googleMapsUrl ?? null,
    coverImageUrl: h.coverImageUrl ?? null,
    logoImageUrl: h.logoImageUrl ?? null,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    listings: h.listings,
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-2 pt-2 text-center">
        <h1 className="font-poster text-4xl font-black tracking-tight text-ink md:text-5xl">
          The same rooms for cheaper
        </h1>
        <p className="text-muted">
          The{" "}
          <span className="font-bold text-[#F97316]">big booking sites keep 15%–17%</span>{" "}
          of every night.{" "}
          <span className="font-bold text-[#0092A1]">We only keep 5%</span> so the money
          stays with you and the places you love.
        </p>
      </div>

      {/* Sticky search bar */}
      <div className="sticky top-[64px] z-40 -mx-4 px-4 py-2 md:-mx-6 md:px-6">
        <div className="mx-auto max-w-4xl">
          <SearchForm />
        </div>
      </div>

      <HotelGrid hotels={serializedHotels} />
      <div className="text-center text-sm text-muted">
        New here? <Link className="font-semibold text-ink underline underline-offset-2 hover:text-brand" href="/sign-up">Create your account</Link>
      </div>
    </div>
  );
}
