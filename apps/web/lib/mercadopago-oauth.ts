import { createHash, createHmac, timingSafeEqual } from "crypto";
import { getSiteUrl } from "@/lib/site-url";

const AUTH_URL = "https://auth.mercadopago.com.mx/authorization";
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const STATE_TTL_MS = 30 * 60 * 1000;

/** Client ID of the Aldeitas Mercado Pago app (explicit, or the segment inside its access token). */
export function getMercadoPagoClientId() {
  const explicit = process.env.MERCADOPAGO_CLIENT_ID?.trim();
  if (explicit) return explicit;
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_PROD_ACCESS_TOKEN || "";
  return /^APP_USR-(\d+)-/.exec(token)?.[1] ?? "";
}

export function isMercadoPagoOAuthConfigured() {
  return Boolean(getMercadoPagoClientId() && process.env.MERCADOPAGO_CLIENT_SECRET);
}

export function getMercadoPagoRedirectUri() {
  return process.env.MERCADOPAGO_OAUTH_REDIRECT_URI?.trim() || `${getSiteUrl()}/api/mercadopago/oauth/callback`;
}

function stateKey() {
  const secret = process.env.MERCADOPAGO_CLIENT_SECRET || process.env.CRON_SECRET || "aldeitas-dev-only-mp-oauth";
  return createHash("sha256").update(`mp-oauth:${secret}`).digest();
}

function sign(payload: string) {
  return createHmac("sha256", stateKey()).update(payload).digest("base64url");
}

/** Signed, expiring OAuth `state` binding the authorization to one hotel and one signed-in user. */
export function createMercadoPagoState(hotelId: string, userId: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ h: hotelId, u: userId, t: now })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyMercadoPagoState(state: string, now = Date.now()): { hotelId: string; userId: string } | null {
  const [payload, mac] = state.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { h, u, t } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { h?: unknown; u?: unknown; t?: unknown };
    if (typeof h !== "string" || typeof u !== "string" || typeof t !== "number") return null;
    if (now - t > STATE_TTL_MS || t - now > 60_000) return null;
    return { hotelId: h, userId: u };
  } catch {
    return null;
  }
}

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** `userId` placed in the OAuth state when a hotel connects from an invite link instead of a signed-in session. */
export const MERCADOPAGO_INVITE_USER = "invite";

/** Signed, expiring link token that lets one hotel connect Mercado Pago without signing in. */
export function createMercadoPagoInvite(hotelId: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ h: hotelId, t: now })).toString("base64url");
  const mac = sign(`invite:${payload}`);
  return `${payload}.${mac}`;
}

export function verifyMercadoPagoInvite(token: string, now = Date.now()): { hotelId: string } | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(`invite:${payload}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { h, t } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { h?: unknown; t?: unknown };
    if (typeof h !== "string" || typeof t !== "number") return null;
    if (now - t > INVITE_TTL_MS || t - now > 60_000) return null;
    return { hotelId: h };
  } catch {
    return null;
  }
}

export function getMercadoPagoAuthorizeUrl(state: string) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", getMercadoPagoClientId());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", getMercadoPagoRedirectUri());
  return url.toString();
}

export type MercadoPagoOAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  publicKey: string | null;
  userId: string;
  expiresAt: Date | null;
};

export function exchangeMercadoPagoCode(code: string) {
  return requestMercadoPagoToken({ grant_type: "authorization_code", code, redirect_uri: getMercadoPagoRedirectUri() });
}

export function refreshMercadoPagoToken(refreshToken: string) {
  return requestMercadoPagoToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

async function requestMercadoPagoToken(grant: Record<string, string>): Promise<MercadoPagoOAuthTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: getMercadoPagoClientId(),
      client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
      ...grant,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof data.access_token !== "string" || data.user_id == null) {
    throw new Error(`Mercado Pago OAuth failed (${res.status}): ${String(data.message ?? data.error ?? "no token")}`);
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : null;
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : null,
    publicKey: typeof data.public_key === "string" ? data.public_key : null,
    userId: String(data.user_id),
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
  };
}

/** Account email/nickname shown as "Connected as …". Best effort. */
export async function fetchMercadoPagoAccount(accessToken: string) {
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string; nickname?: string };
    return { email: data.email ?? null, nickname: data.nickname ?? null };
  } catch {
    return null;
  }
}
