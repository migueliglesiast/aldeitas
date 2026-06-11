import { getHotelsWithListings } from "@/lib/data";
import HomePageContent from "@/components/HomePageContent";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const hotels = await getHotelsWithListings();
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
    const ai = orderMap.has(a.name) ? (orderMap.get(a.name) as number) : Number.MAX_SAFE_INTEGER;
    const bi = orderMap.has(b.name) ? (orderMap.get(b.name) as number) : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  const serializedHotels = sorted.map((h) => ({
    id: h.id,
    name: h.name,
    description: h.description,
    descriptionEn: h.descriptionEn ?? null,
    descriptionEs: h.descriptionEs ?? null,
    location: h.location,
    googleMapsUrl: h.googleMapsUrl || null,
    latitude: h.latitude ?? null,
    longitude: h.longitude ?? null,
    coverImageUrl: h.coverImageUrl || null,
    logoImageUrl: h.logoImageUrl || null,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    images: h.images,
    listings: h.listings,
  }));

  return <HomePageContent hotels={serializedHotels} />;
}
