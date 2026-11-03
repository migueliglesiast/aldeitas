import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secret-crypto";
import { getSiteUrl } from "@/lib/site-url";
import {
  exchangeMercadoPagoCode,
  fetchMercadoPagoAccount,
  verifyMercadoPagoState,
} from "@/lib/mercadopago-oauth";

export const dynamic = "force-dynamic";

function back(result: "connected" | "denied" | "error") {
  return NextResponse.redirect(new URL(`/admin?welcome=payouts&mp=${result}`, getSiteUrl()));
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const verified = verifyMercadoPagoState(params.get("state") ?? "");
  if (!verified) return back("error");

  const user = await getCurrentUser();
  if (!user || user.id !== verified.userId) return back("error");
  const manager = await prisma.hotelManager.findFirst({
    where: { userId: user.id, hotelId: verified.hotelId },
    select: { hotelId: true },
  });
  if (!manager) return back("error");

  const code = params.get("code");
  if (!code) return back("denied");

  try {
    const tokens = await exchangeMercadoPagoCode(code);
    const account = await fetchMercadoPagoAccount(tokens.accessToken);
    const hotel = await prisma.hotel.findUnique({
      where: { id: manager.hotelId },
      select: { payoutMercadoPagoEmail: true },
    });
    await prisma.hotel.update({
      where: { id: manager.hotelId },
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
    return back("connected");
  } catch (error) {
    console.error("[mercadopago-oauth] token exchange failed", error instanceof Error ? error.message : error);
    return back("error");
  }
}
