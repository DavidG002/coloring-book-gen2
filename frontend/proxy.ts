import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Gates the entire app behind sign-in — there's no public signup, so
// anything not logged in should land on /login, not see a partially
// loaded page. /api/auth/* (NextAuth's own routes) and static assets are
// excluded via the matcher below, not here.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
