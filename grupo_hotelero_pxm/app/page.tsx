import Link from "next/link";
import { getHotelsWithListings } from "@/lib/data";
import HotelGrid from "@/components/HotelGrid";
import SearchForm from "@/components/SearchForm";

// Make homepage dynamic to ensure it works at runtime
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const hotels = await getHotelsWithListings();
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
  const sorted = [...(hotels as any[])].sort((a, b) => {
    const ai = orderMap.has(a.name) ? (orderMap.get(a.name) as number) : Number.MAX_SAFE_INTEGER;
    const bi = orderMap.has(b.name) ? (orderMap.get(b.name) as number) : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
  
  // Ensure googleMapsUrl is explicitly included in serialization
  const serializedHotels = sorted.map(h => ({
    id: h.id,
    name: h.name,
    description: h.description,
    location: h.location,
    googleMapsUrl: h.googleMapsUrl || null, // Explicitly include
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    listings: h.listings
  }));

  return (
    <div className="space-y-8">
      {/* Modern Search Form */}
      <div className="w-full">
        <SearchForm />
      </div>

      <HotelGrid hotels={serializedHotels as any} />
      <div className="text-sm text-gray-600">
        New here? <Link className="text-black underline" href="/sign-up">Create your account</Link>
      </div>
    </div>
    
  );
}

