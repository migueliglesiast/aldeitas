import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secret-crypto";
import { getSiteUrl } from "@/lib/site-url";
import {
  exchangeMercadoPagoCode,
  fetchMercadoPagoAccount,
  MERCADOPAGO_INVITE_USER,
  verifyMercadoPagoState,
} from "@/lib/mercadopago-oauth";

export const dynamic = "force-dynamic";

type Result = "connected" | "denied" | "error";

function back(result: Result) {
  return NextResponse.redirect(new URL(`/admin?welcome=payouts&mp=${result}`, getSiteUrl()));
}

function backToInvite(result: Result) {
  return NextResponse.redirect(new URL(`/conectar/listo?mp=${result}`, getSiteUrl()));
}

async function resolveHotel(verified: { hotelId: string; userId: string }) {
  if (verified.userId === MERCADOPAGO_INVITE_USER) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: verified.hotelId },
      select: { id: true, mercadoPagoConnectedAt: true },
    });
    // Invite links connect a hotel once; reconnecting needs a signed-in manager.
    return hotel && !hotel.mercadoPagoConnectedAt ? hotel.id : null;
  }
  const user = await getCurrentUser();
  if (!user || user.id !== verified.userId) return null;
  const manager = await prisma.hotelManager.findFirst({
    where: { userId: user.id, hotelId: verified.hotelId },
    select: { hotelId: true },
  });
  return manager?.hotelId ?? null;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const verified = verifyMercadoPagoState(params.get("state") ?? "");
  if (!verified) return back("error");

  const done = verified.userId === MERCADOPAGO_INVITE_USER ? backToInvite : back;
  const hotelId = await resolveHotel(verified);
  if (!hotelId) return done("error");

  const code = params.get("code");
  if (!code) return done("denied");

  try {
    const tokens = await exchangeMercadoPagoCode(code);
    const account = await fetchMercadoPagoAccount(tokens.accessToken);
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { payoutMercadoPagoEmail: true },
    });
    await prisma.hotel.update({
      where: { id: hotelId },
      data: {
        mercadoPagoUserId: tokens.userId,
        mercadoPagoAccessTokenEnc: encryptSecret(tokens.accessToken),
        mercadoPagoRefreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        mercadoPagoPublicKey: tokens.publicKey,
        mercadoPagoTokenExpiresAt: tokens.expiresAt,
        mercadoPagoAccount: account?.email ?? account?.nickname ?? null,
        mercadoPagoConnectedAt: new Date(),
        ...(!hotel?.payoutMercadoPagoEmail && account?.email ? { payoutMercadoPagoEmail: account.email } : {}),
      },
    });
    return done("connected");
  } catch (error) {
    console.error("[mercadopago-oauth] token exchange failed", error instanceof Error ? error.message : error);
    return done("error");
  }
}
