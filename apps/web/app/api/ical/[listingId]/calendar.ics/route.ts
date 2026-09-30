import { NextRequest } from "next/server";
import { buildListingIcalResponse } from "@/lib/ical-export";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await params;
  const response = await buildListingIcalResponse(listingId);
  if (!response) return new Response("Not found", { status: 404 });
  return response;
}

export const dynamic = "force-dynamic";
