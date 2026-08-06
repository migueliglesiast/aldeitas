import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const listings = await prisma.listing.findMany({
      include: {
        hotel: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(listings);
  } catch (error) {
    console.error("[Listings] Error listing listings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

