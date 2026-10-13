import { NextRequest, NextResponse } from "next/server";
import { requireHotelManager } from "@/lib/admin-hotel-auth";
import { prisma } from "@/lib/prisma";
import { guestAnswerSchema } from "@/lib/whatsapp/guest-answer-schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; answerId: string }> };

async function authorize(id: string, answerId: string) {
  const auth = await requireHotelManager(id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const existing = await prisma.guestAnswer.findFirst({ where: { id: answerId, hotelId: id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return null;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, answerId } = await params;
  const denied = await authorize(id, answerId);
  if (denied) return denied;
  const parsed = guestAnswerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const answer = await prisma.guestAnswer.update({
    where: { id: answerId },
    data: {
      question: parsed.data.question,
      answer: parsed.data.answer,
      listingId: parsed.data.listingId ?? null,
      verifiedOnly: parsed.data.verifiedOnly ?? false,
    },
  });
  return NextResponse.json({ answer });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, answerId } = await params;
  const denied = await authorize(id, answerId);
  if (denied) return denied;
  await prisma.guestAnswer.delete({ where: { id: answerId } });
  return NextResponse.json({ ok: true });
}
