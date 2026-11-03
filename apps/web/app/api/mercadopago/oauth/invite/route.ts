import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import {
  createMercadoPagoState,
  getMercadoPagoAuthorizeUrl,
  isMercadoPagoOAuthConfigured,
  MERCADOPAGO_INVITE_USER,
  verifyMercadoPagoInvite,
} from "@/lib/mercadopago-oauth";

export const dynamic = "force-dynamic";

function done(result: "connected" | "error" | "unavailable") {
  return NextResponse.redirect(new URL(`/conectar/listo?mp=${result}`, getSiteUrl()));
}

export async function GET(req: NextRequest) {
  const invite = verifyMercadoPagoInvite(req.nextUrl.searchParams.get("t") ?? "");
  if (!invite) return done("error");
  const hotel = await prisma.hotel.findUnique({
    where: { id: invite.hotelId },
    select: { id: true, mercadoPagoConnectedAt: true },
  });
  if (!hotel) return done("error");
  if (hotel.mercadoPagoConnectedAt) return done("connected");
  if (!isMercadoPagoOAuthConfigured()) return done("unavailable");
  return NextResponse.redirect(
    getMercadoPagoAuthorizeUrl(createMercadoPagoState(hotel.id, MERCADOPAGO_INVITE_USER)),
  );
}
