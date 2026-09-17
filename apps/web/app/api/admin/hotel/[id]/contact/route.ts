import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const contactSchema = z.object({
  type: z.enum(["CLEANER", "PLUMBER_ELECTRICIAN", "INTERNET_TECH", "AC_TECH", "MAIN_MAINTENANCE"]),
  name: z.string().min(1),
  phone: z.string().min(1),
});

export async function POST(
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
    const data = contactSchema.parse(body);

    const contact = await prisma.hotelContact.create({
      data: {
        hotelId: params.id,
        type: data.type,
        name: data.name,
        phone: data.phone,
      },
    });

    return NextResponse.json({ contact });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("[admin/hotel/contact] Error:", error);
    console.error("[admin/hotel/contact] Error stack:", error.stack);
    console.error("[admin/hotel/contact] Error message:", error.message);
    return NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    }, { status: 500 });
  }
}

