import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateProfileSchema = z.object({
  nickname: z.string().min(1),
  fullName: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("[admin/profile] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateProfileSchema.parse(body);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        nickname: data.nickname,
        fullName: data.fullName || null,
        phoneNumber: data.phoneNumber || null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        nickname: true,
        fullName: true,
        phoneNumber: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("[admin/profile] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


