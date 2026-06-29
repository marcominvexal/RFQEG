import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth-token";

const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public assets, auth API, and the Gmail OAuth callback.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/gmail") ||
    pathname === "/favicon.ico" ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const user = token ? await verifyToken(token) : null;

  // API routes: return 401 JSON.
  if (pathname.startsWith("/api")) {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  // App pages: redirect to login.
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
