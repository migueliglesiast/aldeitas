import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { signInUrl } from "@/lib/auth-redirect";
import { getPrimaryHotelId } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import {
  createMercadoPagoState,
  getMercadoPagoAuthorizeUrl,
  isMercadoPagoOAuthConfigured,
} from "@/lib/mercadopago-oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const site = getSiteUrl();
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(signInUrl("/admin?welcome=mercadopago"), site));

  const requested = req.nextUrl.searchParams.get("hotel");
  const hotelId = requested
    ? (await prisma.hotelManager.findFirst({ where: { userId: user.id, hotelId: requested }, select: { hotelId: true } }))?.hotelId
    : await getPrimaryHotelId(user.id);
  if (!hotelId) return NextResponse.redirect(new URL("/admin", site));

  if (!isMercadoPagoOAuthConfigured()) {
    return NextResponse.redirect(new URL("/admin?welcome=mercadopago&mp=unavailable", site));
  }
  return NextResponse.redirect(getMercadoPagoAuthorizeUrl(createMercadoPagoState(hotelId, user.id)));
}
