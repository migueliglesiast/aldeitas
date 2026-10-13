import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function secret() {
  return (
    process.env.WHATSAPP_ROOM_CODE_SECRET ||
    process.env.WHATSAPP_APP_SECRET ||
    process.env.BOOKING_RECONCILE_SECRET ||
    "aldeitas-room-code"
  );
}

export function roomCode(listingId: string) {
  const digest = createHmac("sha256", secret()).update(listingId).digest();
  let code = "";
  for (let i = 0; i < 6; i += 1) code += ALPHABET[digest[i] % ALPHABET.length];
  return code;
}

export function extractRoomCode(text: string) {
  const match = text.match(/c[oó]d(?:igo)?\s*[:#]?\s*([A-Z0-9]{6})\b/i) || text.match(/\bcode\s*[:#]?\s*([A-Z0-9]{6})\b/i);
  return match ? match[1].toUpperCase() : null;
}

export function findListingIdByRoomCode(code: string, listingIds: string[]) {
  return listingIds.find((id) => roomCode(id) === code) ?? null;
}

export function roomQrLink(businessNumber: string, listingId: string, roomTitle: string) {
  const text = `Hola, estoy en ${roomTitle} · código ${roomCode(listingId)}`;
  return `https://wa.me/${businessNumber.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
