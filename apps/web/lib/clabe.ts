const WEIGHTS = [3, 7, 1];

/** 18-digit Mexican CLABE with a valid control digit. */
export function isValidClabe(value: string) {
  if (!/^\d{18}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const sum = digits
    .slice(0, 17)
    .reduce((acc, d, i) => acc + ((d * WEIGHTS[i % 3]) % 10), 0);
  return (10 - (sum % 10)) % 10 === digits[17];
}

export function normalizeClabe(value: string) {
  return value.replace(/[\s-]/g, "");
}

/** Groups CLABE digits as bank (3) · branch (3) · account (11) · check (1). */
export function formatClabe(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 18);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 17), d.slice(17)]
    .filter(Boolean)
    .join(" ");
}
