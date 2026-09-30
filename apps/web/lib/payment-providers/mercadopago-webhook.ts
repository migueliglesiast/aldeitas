import { createHmac, timingSafeEqual } from "crypto";

function parseSignatureHeader(header: string) {
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }
  return { ts, v1 };
}

export function buildMercadoPagoSignatureManifest(
  dataId: string | null | undefined,
  requestId: string | null | undefined,
  ts: string
) {
  const parts: string[] = [];
  if (dataId) parts.push(`id:${dataId}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  parts.push(`ts:${ts}`);
  return `${parts.join(";")};`;
}

/** Verifies the `x-signature` header Mercado Pago sends with webhook notifications. */
export function isValidMercadoPagoSignature(params: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}) {
  if (!params.signature) return false;
  const { ts, v1 } = parseSignatureHeader(params.signature);
  if (!ts || !/^\d+$/.test(ts) || !v1) return false;

  const manifest = buildMercadoPagoSignatureManifest(
    params.dataId?.trim(),
    params.requestId?.trim(),
    ts
  );
  const expected = createHmac("sha256", params.secret).update(manifest).digest("hex");
  const received = Buffer.from(v1);
  const computed = Buffer.from(expected);
  return received.length === computed.length && timingSafeEqual(received, computed);
}
