import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "./lib/session";
import { isAllowedUser } from "./lib/users";

// Everything except the login page, login endpoint, health check and static assets
// requires a valid session. This includes /api/photos/* so images are never public.
const PUBLIC = ["/login", "/api/login", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  // CSRF defence in depth (on top of SameSite=Lax cookies): state-changing requests made by a
  // browser must be same-origin. Sec-Fetch-Site is set by the browser and cannot be forged by
  // page scripts; fall back to comparing the Origin header for older browsers.
  // (Don't rely on Origin alone: with Referrer-Policy no-referrer browsers send "Origin: null".)
  if (req.method !== "GET" && req.method !== "HEAD") {
    const site = req.headers.get("sec-fetch-site");
    if (site) {
      if (site !== "same-origin" && site !== "none") return new NextResponse("Forbidden", { status: 403 });
    } else {
      const origin = req.headers.get("origin");
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
      if (origin) {
        let originHost = "";
        try {
          originHost = new URL(origin).host;
        } catch {}
        if (!host || originHost !== host) return new NextResponse("Forbidden", { status: 403 });
      }
    }
  }

  const user = await verifySessionToken(req.cookies.get(COOKIE_NAME)?.value).catch(() => null);
  if (user && isAllowedUser(user)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Middleware requires an absolute URL. Build it from the proxy headers (Railway sets
  // x-forwarded-host / x-forwarded-proto) rather than req.url, which can show the internal host.
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const fwdProto = (req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "")).split(",")[0];
  return NextResponse.redirect(new URL("/login", `${fwdProto}://${fwdHost}`), 307);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
