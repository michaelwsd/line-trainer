import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale, negotiateLocale } from "@/i18n/config";

/**
 * - Locale URLs (/en, /zh/...) pass through, and the locale is remembered in a cookie.
 * - Locale-less URLs redirect to /{locale}/..., preferring the remembered locale, then the browser language.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    const response = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return response;
  }

  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : negotiateLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and any path that looks like a file (favicon.ico, images, ...).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
