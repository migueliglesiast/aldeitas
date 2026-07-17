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

/** URL for unauthenticated admin access — sign-in form lives on /admin. */
export function signInUrl(next?: string): string {
  const path = safeNextPath(next, "");
  if (!path || path === "/admin") return "/admin";
  return `/admin?next=${encodeURIComponent(path)}`;
}
