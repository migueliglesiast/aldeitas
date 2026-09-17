import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; calendarId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const calendar = await prisma.calendarSource.findUnique({
    where: { id: params.calendarId },
    include: {
      listing: {
        include: {
          hotel: {
            include: {
              managers: {
                where: { userId: user.id },
              },
            },
          },
        },
      },
    },
  });

  if (!calendar || calendar.listingId !== params.id) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  if (!calendar.listing || calendar.listing.hotel.managers.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await prisma.calendarSource.delete({
    where: { id: params.calendarId },
  });

  return NextResponse.json({ ok: true });
}
