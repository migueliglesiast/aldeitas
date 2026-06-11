import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
}


