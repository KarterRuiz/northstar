import { type NextRequest, NextResponse } from "next/server";

import { isAuthCallbackPath } from "@/lib/auth/auth-redirect";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // PKCE exchange writes Set-Cookie on the callback response. Do not refresh or
  // overwrite those cookies in middleware on the same request.
  if (isAuthCallbackPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const { supabase, response } = await updateSession(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !user) {
    const login = new URL("/login", request.url);
    const next = `${pathname}${request.nextUrl.search}`;
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next internals and common static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
