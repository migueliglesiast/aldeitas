import Link from "next/link";
import { getHotelsWithListings } from "@/lib/data";
import HotelGrid from "@/components/HotelGrid";

export default async function HomePage() {
  const hotels = await getHotelsWithListings();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Find your stay</h1>
          <p className="text-gray-600">Browse, compare, and reserve instantly.</p>
        </div>
        <Link
          href="/admin/calendars"
          className="rounded bg-[#00a19c] px-4 py-2 text-white hover:bg-[#008a86]"
        >
          Manage Calendars
        </Link>
      </div>

      <HotelGrid hotels={hotels as any} />
      <div className="text-sm text-gray-600">
        New here? <Link className="text-black underline" href="/sign-up">Create your account</Link>
      </div>
    </div>
    
  );
}

