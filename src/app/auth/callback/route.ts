import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isRole, roleDashboardHref } from "@/config/roles";
import {
  AUTH_SETUP_PASSWORD_PATH,
  PASSWORD_SETUP_COOKIE,
  mapAuthCallbackDestination,
} from "@/lib/auth/auth-redirect";
import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

function htmlHashForward(targetPath: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NorthStar</title>
    <script>
      (function () {
        var hash = window.location.hash || "";
        var target = ${JSON.stringify(targetPath)};
        if (
          hash &&
          (hash.indexOf("access_token") !== -1 ||
            hash.indexOf("refresh_token") !== -1 ||
            hash.indexOf("type=recovery") !== -1 ||
            hash.indexOf("type=invite") !== -1)
        ) {
          window.location.replace(target + hash);
          return;
        }
        window.location.replace(${JSON.stringify(`${AUTH_SETUP_PASSWORD_PATH}?error=invalid`)});
      })();
    </script>
  </head>
  <body></body>
</html>`;
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function applyPasswordSetupCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(PASSWORD_SETUP_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60,
  });
}

/**
 * PKCE exchange for Auth emails (invite + recovery). Then continue to setup-password
 * or a safe in-app next path. Never dumps first-time users onto Sign In.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL(`${AUTH_SETUP_PASSWORD_PATH}?error=invalid`, origin));
  }

  if (!code) {
    // Implicit-flow tokens live in the URL hash and are invisible to the server.
    return htmlHashForward(AUTH_SETUP_PASSWORD_PATH);
  }

  const { url, anonKey } = getSupabaseUrlAndAnonKey();
  const pendingCookies: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[] = [];
  let extraHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
        });
        extraHeaders = { ...extraHeaders, ...responseHeaders };
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  let roleHref: string | null = null;
  if (!error) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role && isRole(profile.role)) {
        roleHref = roleDashboardHref(profile.role);
      }
    }
  }

  const destination = mapAuthCallbackDestination({
    type,
    next,
    exchangeOk: !error,
    roleHref,
  });

  const response = NextResponse.redirect(new URL(destination.path, origin));
  for (const [key, value] of Object.entries(extraHeaders)) {
    response.headers.set(key, value);
  }
  for (const cookie of pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  if (!error && destination.kind === "setup_password") {
    applyPasswordSetupCookie(response, request);
  }

  return response;
}
