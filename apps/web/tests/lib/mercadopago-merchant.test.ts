// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = { hotel: { findUnique: vi.fn(), update: vi.fn() } };
const refresh = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/mercadopago-oauth", () => ({
  isMercadoPagoOAuthConfigured: () => true,
  refreshMercadoPagoToken: (...args: unknown[]) => refresh(...args),
}));

const { encryptSecret, decryptSecret } = await import("@/lib/secret-crypto");
const { getBookingMercadoPagoToken, getHotelMercadoPagoMerchant, marketplaceFeeCents } = await import("@/lib/mercadopago-merchant");

const DAY = 24 * 60 * 60 * 1000;
function hotel(overrides: Record<string, unknown> = {}) {
  return {
    id: "h1",
    mercadoPagoAccessTokenEnc: encryptSecret("AT"),
    mercadoPagoRefreshTokenEnc: encryptSecret("RT"),
    mercadoPagoPublicKey: "PK",
    mercadoPagoTokenExpiresAt: new Date(Date.now() + 90 * DAY),
    commissionPercent: 12,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MERCADOPAGO_MARKETPLACE_FEE_PERCENT;
});

describe("mercadopago merchant", () => {
  it("computes the commission in cents, capped at the amount", () => {
    expect(marketplaceFeeCents(256500, 10)).toBe(25650);
    expect(marketplaceFeeCents(1000, 0)).toBe(0);
    expect(marketplaceFeeCents(1000, 150)).toBe(1000);
  });

  it("returns null when the hotel hasn't connected", async () => {
    prismaMock.hotel.findUnique.mockResolvedValue(hotel({ mercadoPagoAccessTokenEnc: null }));
    expect(await getHotelMercadoPagoMerchant("h1")).toBeNull();
  });

  it("decrypts the token and uses the hotel's commission, else the default", async () => {
    prismaMock.hotel.findUnique.mockResolvedValue(hotel());
    expect(await getHotelMercadoPagoMerchant("h1")).toEqual({ hotelId: "h1", accessToken: "AT", publicKey: "PK", commissionPercent: 12 });
    process.env.MERCADOPAGO_MARKETPLACE_FEE_PERCENT = "8";
    prismaMock.hotel.findUnique.mockResolvedValue(hotel({ commissionPercent: null }));
    expect((await getHotelMercadoPagoMerchant("h1"))?.commissionPercent).toBe(8);
    delete process.env.MERCADOPAGO_MARKETPLACE_FEE_PERCENT;
    expect((await getHotelMercadoPagoMerchant("h1"))?.commissionPercent).toBe(5);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes and re-encrypts a token about to expire", async () => {
    prismaMock.hotel.findUnique.mockResolvedValue(hotel({ mercadoPagoTokenExpiresAt: new Date(Date.now() + 2 * DAY) }));
    refresh.mockResolvedValue({ accessToken: "AT2", refreshToken: "RT2", publicKey: "PK2", userId: "1", expiresAt: new Date(Date.now() + 180 * DAY) });
    const merchant = await getHotelMercadoPagoMerchant("h1");
    expect(refresh).toHaveBeenCalledWith("RT");
    expect(merchant).toMatchObject({ accessToken: "AT2", publicKey: "PK2" });
    const data = prismaMock.hotel.update.mock.calls[0][0].data;
    expect(decryptSecret(data.mercadoPagoAccessTokenEnc)).toBe("AT2");
    expect(decryptSecret(data.mercadoPagoRefreshTokenEnc)).toBe("RT2");
  });

  it("uses Aldeitas's token for bookings it collected, and fails loudly if the hotel disconnected", async () => {
    expect(await getBookingMercadoPagoToken({ paymentMerchantHotelId: null })).toBeUndefined();
    prismaMock.hotel.findUnique.mockResolvedValue(null);
    await expect(getBookingMercadoPagoToken({ paymentMerchantHotelId: "h1" })).rejects.toThrow(/no longer connected/);
  });
});
