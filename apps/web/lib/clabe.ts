const WEIGHTS = [3, 7, 1];

/** 18-digit Mexican CLABE with a valid control digit. */
export function isValidClabe(value: string) {
  if (!/^\d{18}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const sum = digits.slice(0, 17).reduce((acc, d, i) => acc + ((d * WEIGHTS[i % 3]) % 10), 0);
  return (10 - (sum % 10)) % 10 === digits[17];
}

export function normalizeClabe(value: string) {
  return value.replace(/[\s-]/g, "");
}
