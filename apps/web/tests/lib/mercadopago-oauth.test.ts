// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createMercadoPagoState,
  exchangeMercadoPagoCode,
  getMercadoPagoAuthorizeUrl,
  getMercadoPagoClientId,
  isMercadoPagoOAuthConfigured,
  verifyMercadoPagoState,
} from "@/lib/mercadopago-oauth";

const env = { ...process.env };

beforeEach(() => {
  process.env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-1234567890123456-010101-abcdef-99";
  process.env.MERCADOPAGO_CLIENT_SECRET = "s3cret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://aldeitas.io";
  delete process.env.MERCADOPAGO_CLIENT_ID;
  delete process.env.MERCADOPAGO_OAUTH_REDIRECT_URI;
});
afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("mercadopago oauth", () => {
  it("derives the client id from the app access token and needs the secret", () => {
    expect(getMercadoPagoClientId()).toBe("1234567890123456");
    expect(isMercadoPagoOAuthConfigured()).toBe(true);
    delete process.env.MERCADOPAGO_CLIENT_SECRET;
    expect(isMercadoPagoOAuthConfigured()).toBe(false);
  });

  it("builds the Mexican authorization URL with the callback redirect", () => {
    const url = new URL(getMercadoPagoAuthorizeUrl("st"));
    expect(url.origin + url.pathname).toBe("https://auth.mercadopago.com.mx/authorization");
    expect(url.searchParams.get("client_id")).toBe("1234567890123456");
    expect(url.searchParams.get("redirect_uri")).toBe("https://aldeitas.io/api/mercadopago/oauth/callback");
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("round-trips a signed state and rejects tampering or expiry", () => {
    const now = 1_800_000_000_000;
    const state = createMercadoPagoState("h1", "u1", now);
    expect(verifyMercadoPagoState(state, now + 1000)).toEqual({ hotelId: "h1", userId: "u1" });
    expect(verifyMercadoPagoState(state, now + 31 * 60 * 1000)).toBeNull();
    const [payload, mac] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ h: "h2", u: "u1", t: now })).toString("base64url");
    expect(verifyMercadoPagoState(`${forged}.${mac}`, now)).toBeNull();
    expect(verifyMercadoPagoState(`${payload}.x`, now)).toBeNull();
  });

  it("exchanges the code for tokens", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "AT", refresh_token: "RT", public_key: "PK", user_id: 42, expires_in: 3600 }), { status: 200 })
    );
    const tokens = await exchangeMercadoPagoCode("CODE");
    expect(tokens).toMatchObject({ accessToken: "AT", refreshToken: "RT", publicKey: "PK", userId: "42" });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ client_id: "1234567890123456", client_secret: "s3cret", grant_type: "authorization_code", code: "CODE" });
  });

  it("throws when Mercado Pago refuses the code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "invalid_grant" }), { status: 400 }));
    await expect(exchangeMercadoPagoCode("bad")).rejects.toThrow(/invalid_grant/);
  });
});
