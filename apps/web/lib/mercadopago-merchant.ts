import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import { isMercadoPagoOAuthConfigured, refreshMercadoPagoToken } from "@/lib/mercadopago-oauth";

const REFRESH_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

export type MercadoPagoMerchant = {
  hotelId: string;
  accessToken: string;
  publicKey: string | null;
  commissionPercent: number;
};

function defaultCommissionPercent() {
  const raw = Number(process.env.MERCADOPAGO_MARKETPLACE_FEE_PERCENT);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/** Aldeitas's cut, in cents, of a payment collected by a hotel's own account. */
export function marketplaceFeeCents(amountCents: number, percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(amountCents, Math.round((amountCents * Math.min(percent, 100)) / 100));
}

/** The hotel's connected Mercado Pago account (token refreshed when close to expiry), or null. */
export async function getHotelMercadoPagoMerchant(hotelId: string): Promise<MercadoPagoMerchant | null> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      id: true,
      mercadoPagoAccessTokenEnc: true,
      mercadoPagoRefreshTokenEnc: true,
      mercadoPagoPublicKey: true,
      mercadoPagoTokenExpiresAt: true,
      commissionPercent: true,
    },
  });
  if (!hotel?.mercadoPagoAccessTokenEnc) return null;

  let accessToken = decryptSecret(hotel.mercadoPagoAccessTokenEnc);
  let publicKey = hotel.mercadoPagoPublicKey;
  const expiresAt = hotel.mercadoPagoTokenExpiresAt?.getTime();
  if (
    expiresAt &&
    expiresAt - Date.now() < REFRESH_BEFORE_MS &&
    hotel.mercadoPagoRefreshTokenEnc &&
    isMercadoPagoOAuthConfigured()
  ) {
    try {
      const fresh = await refreshMercadoPagoToken(decryptSecret(hotel.mercadoPagoRefreshTokenEnc));
      accessToken = fresh.accessToken;
      publicKey = fresh.publicKey ?? publicKey;
      await prisma.hotel.update({
        where: { id: hotel.id },
        data: {
          mercadoPagoAccessTokenEnc: encryptSecret(fresh.accessToken),
          mercadoPagoRefreshTokenEnc: fresh.refreshToken ? encryptSecret(fresh.refreshToken) : hotel.mercadoPagoRefreshTokenEnc,
          mercadoPagoPublicKey: publicKey,
          mercadoPagoTokenExpiresAt: fresh.expiresAt,
        },
      });
    } catch (error) {
      console.error("[mercadopago-merchant] token refresh failed", hotel.id, error instanceof Error ? error.message : error);
      if (expiresAt < Date.now()) return null;
    }
  }

  return {
    hotelId: hotel.id,
    accessToken,
    publicKey,
    commissionPercent: hotel.commissionPercent ?? defaultCommissionPercent(),
  };
}

/** Access token for API calls on a booking's payment: the collecting hotel's, or undefined for Aldeitas's own. */
export async function getBookingMercadoPagoToken(booking: { paymentMerchantHotelId?: string | null }) {
  if (!booking.paymentMerchantHotelId) return undefined;
  const merchant = await getHotelMercadoPagoMerchant(booking.paymentMerchantHotelId);
  if (!merchant) throw new Error(`Mercado Pago account of hotel ${booking.paymentMerchantHotelId} is no longer connected`);
  return merchant.accessToken;
}
