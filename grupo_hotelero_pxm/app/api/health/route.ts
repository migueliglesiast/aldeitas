import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const envStatus = {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
  };

  try {
    const hotelCount = await prisma.hotel.count();
    return NextResponse.json({
      ok: true,
      hotelCount,
      ...envStatus,
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "database_unreachable",
        ...envStatus,
      },
      { status: 500 }
    );
  }
}
