import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeListingImages } from "@/lib/airbnb";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.NEXT_RUNTIME === 'edge' || process.env.NEXT_PHASE === 'phase-export') {
    return NextResponse.json({ error: 'Not available in static export' }, { status: 405 });
  }
  const { listingId } = await req.json();
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const urls = await scrapeListingImages(listing.airbnbUrl);
  await prisma.image.deleteMany({ where: { listingId } });
  await prisma.$transaction(
    urls.map((url, idx) =>
      prisma.image.create({ data: { listingId, url, position: idx } })
    )
  );
  return NextResponse.json({ count: urls.length });
}


