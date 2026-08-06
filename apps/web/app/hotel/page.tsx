import { getHotelsWithListings } from "@/lib/data";
import HotelGrid from "@/components/HotelGrid";

export default async function HotelsIndexPage() {
  const hotels = await getHotelsWithListings();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Browse Hotels</h1>
      <HotelGrid hotels={hotels as any} />
    </div>
  );
}

export const dynamic = "force-dynamic";



