import { getHotelsWithListings } from "@/lib/data";
import HotelGrid from "@/components/HotelGrid";

export default async function HotelsIndexPage() {
  const hotels = await getHotelsWithListings();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Browse Hotels</h1>
      <HotelGrid hotels={hotels} />
    </div>
  );
}

export const dynamic = "force-dynamic";
