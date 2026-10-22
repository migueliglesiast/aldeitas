import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPortalOrigin, isPortalHost, normalizeHost } from "./lib/storefront-host";

const CHROMELESS_PATH = /^\/offer\/[^/]+\/fotos\/?$/;

export function middleware(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));
  const pathname = request.nextUrl.pathname;
  const chromeless = CHROMELESS_PATH.test(pathname);

  if (host && !isPortalHost(host)) {
    if (pathname.startsWith("/admin")) {
      const portal = getPortalOrigin();
      const target = new URL(pathname + request.nextUrl.search, portal);
      return NextResponse.redirect(target);
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-storefront-host", host);
    if (chromeless) requestHeaders.set("x-chromeless", "1");

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  if (chromeless) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-chromeless", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
