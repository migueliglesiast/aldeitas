/** Safe internal path only — blocks open redirects. */
export function safeNextPath(
  value: string | null | undefined,
  fallback = "/"
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}

export function signInUrl(next?: string): string {
  const path = safeNextPath(next, "");
  if (!path) return "/sign-in";
  return `/sign-in?next=${encodeURIComponent(path)}`;
}
