/** Mexican RFC: 12 chars (company) or 13 chars (individual) — letters, YYMMDD, 3-char homoclave. */
const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;

export function normalizeRfc(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidRfc(value: string) {
  return RFC_PATTERN.test(value);
}
