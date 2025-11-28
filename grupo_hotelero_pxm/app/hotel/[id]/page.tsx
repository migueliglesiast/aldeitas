import { getHotelDetail } from "@/lib/data";
import Image from "next/image";
import Link from "next/link";

export default async function HotelPage({ params }: { params: { id: string } }) {
  const hotel = await getHotelDetail(params.id);
  if (!hotel) {
    return <div>Hotel not found</div>;
  }
  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-2 rounded bg-[#00a19c] px-3 py-2 text-white hover:bg-[#008a86]">
          ← Back
        </Link>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{hotel.name}</h1>
        <p className="text-gray-600">{hotel.location}</p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {hotel.listings.map((l) => (
          <Link key={l.id} href={`/listing/${l.id}`} className="group rounded border hover:shadow">
            <div className="relative h-44 w-full overflow-hidden rounded-t">
              {l.images?.[0] ? (
                <Image src={l.images[0].url} alt={l.title} fill className="object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">No image yet</div>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{l.title}</p>
                <p className="text-sm text-gray-500">${(l.nightlyBasePrice / 100).toFixed(0)}</p>
              </div>
            </div>
          </Link>
        ))}
        {hotel.listings.length === 0 && <div className="text-gray-600">No rooms listed yet.</div>}
      </div>
    </div>
  );
}


