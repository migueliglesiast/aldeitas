import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncBilingualDescription } from "@/lib/sync-bilingual-description";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateHotelSchema = z.object({
  description: z.string(),
  mainContactNumber: z.string().optional().nullable(),
  logoImageUrl: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a manager of this hotel
    const hotelManager = await prisma.hotelManager.findFirst({
      where: {
        userId: user.id,
        hotelId: params.id,
      },
    });

    if (!hotelManager) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const data = updateHotelSchema.parse(body);
    const bilingual = await syncBilingualDescription(data.description);

    const updated = await prisma.hotel.update({
      where: { id: params.id },
      data: {
        description: bilingual.description,
        descriptionEn: bilingual.descriptionEn,
        descriptionEs: bilingual.descriptionEs,
        mainContactNumber: data.mainContactNumber,
        logoImageUrl: data.logoImageUrl,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    return NextResponse.json({ hotel: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("[admin/hotel] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


