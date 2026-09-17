import { NextRequest, NextResponse } from "next/server";
import { POST as importAirbnb } from "../import-airbnb/route";

export const dynamic = "force-dynamic";

/** @deprecated Use /import-airbnb instead */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const body = await req.json();
  const wrapped = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({
      ...body,
      importPhotos: true,
      importDescription: false,
    }),
  });
  return importAirbnb(wrapped, context);
}
