export function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

/** WhatsApp sends Mexican mobiles as 521XXXXXXXXXX or 52XXXXXXXXXX; compare on the last 10 digits. */
export function phoneKey(phone: string) {
  const digits = digitsOnly(phone);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function samePhone(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const ka = phoneKey(a);
  return ka.length >= 8 && ka === phoneKey(b);
}

export function toWhatsappRecipient(phone: string) {
  const digits = digitsOnly(phone);
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

/** Stable key for a WhatsApp user: digits, with Mexico's legacy mobile "521" prefix folded to "52". */
export function canonicalPhone(phone: string) {
  const digits = toWhatsappRecipient(phone);
  if (digits.length === 13 && digits.startsWith("521")) return `52${digits.slice(3)}`;
  return digits;
}
