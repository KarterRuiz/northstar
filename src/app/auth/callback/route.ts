import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { isRole, roleDashboardHref } from "@/config/roles";
import {
  accumulateAuthCookies,
  AUTH_CALLBACK_CACHE_HEADERS,
  isHttpsRequest,
  sanitizeAuthCookieWriteOptions,
  type PendingAuthCookie,
} from "@/lib/auth/auth-callback";
import {
  AUTH_CALLBACK_PATH,
  AUTH_SETUP_PASSWORD_PATH,
  mapAuthCallbackDestination,
} from "@/lib/auth/auth-redirect";
import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

export const dynamic = "force-dynamic";

type CallbackCookieState = {
  pendingCookies: PendingAuthCookie[];
  extraHeaders: Record<string, string>;
};

type CallbackSupabase = {
  supabase: ReturnType<typeof createServerClient<Database>>;
  state: CallbackCookieState;
};

function requestIsHttpsFrom(request: NextRequest): boolean {
  return isHttpsRequest({
    protocol: request.nextUrl.protocol,
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
}

function applyCookiesToRedirect(
  response: NextResponse,
  state: CallbackCookieState,
): NextResponse {
  for (const [key, value] of Object.entries({
    ...AUTH_CALLBACK_CACHE_HEADERS,
    ...state.extraHeaders,
  })) {
    response.headers.set(key, value);
  }
  for (const cookie of state.pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

async function createCallbackSupabase(request: NextRequest): Promise<CallbackSupabase> {
  const { url, anonKey } = getSupabaseUrlAndAnonKey();
  const cookieStore = await cookies();
  const requestIsHttps = requestIsHttpsFrom(request);
  const state: CallbackCookieState = {
    pendingCookies: [],
    extraHeaders: {},
  };

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(
              name,
              value,
              sanitizeAuthCookieWriteOptions(options, requestIsHttps),
            );
          });
        } catch {
          // Route handler can always set cookies; ignore if the store rejects a field.
        }
        state.pendingCookies = accumulateAuthCookies(
          state.pendingCookies,
          cookiesToSet,
          requestIsHttps,
        );
        Object.assign(state.extraHeaders, responseHeaders);
      },
    },
  });

  return { supabase, state };
}

async function resolveRoleHref(
  supabase: CallbackSupabase["supabase"],
): Promise<{ userId: string | null; roleHref: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { userId: null, roleHref: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role && isRole(profile.role)) {
    return { userId: user.id, roleHref: roleDashboardHref(profile.role) };
  }
  return { userId: user.id, roleHref: null };
}

function htmlHashForward(): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NorthStar</title>
    <script>
      (function () {
        var hash = window.location.hash || "";
        var callback = ${JSON.stringify(AUTH_CALLBACK_PATH)};
        var invalid = ${JSON.stringify(`${AUTH_SETUP_PASSWORD_PATH}?error=invalid`)};
        var setup = ${JSON.stringify(AUTH_SETUP_PASSWORD_PATH)};
        var params = new URLSearchParams(hash.charAt(0) === "#" ? hash.slice(1) : hash);
        var accessToken = params.get("access_token");
        var refreshToken = params.get("refresh_token");
        var type = params.get("type");

        function go(path) {
          window.location.replace(path);
        }

        if (accessToken && refreshToken) {
          fetch(callback, {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              access_token: accessToken,
              refresh_token: refreshToken,
              type: type,
            }),
          })
            .then(function (res) {
              return res.json().then(function (data) {
                if (data && data.ok && typeof data.next === "string") {
                  go(data.next);
                  return;
                }
                throw new Error("implicit-handoff-failed");
              });
            })
            .catch(function () {
              go(setup + hash);
            });
          return;
        }

        if (
          hash &&
          (hash.indexOf("access_token") !== -1 ||
            hash.indexOf("refresh_token") !== -1 ||
            hash.indexOf("type=recovery") !== -1 ||
            hash.indexOf("type=invite") !== -1)
        ) {
          go(setup + hash);
          return;
        }
        go(invalid);
      })();
    </script>
  </head>
  <body></body>
</html>`;
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...AUTH_CALLBACK_CACHE_HEADERS,
    },
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

  console.info("[auth/callback]", {
    codePresent: Boolean(code),
    errorParam: Boolean(errorParam),
  });

  if (errorParam) {
    return NextResponse.redirect(new URL(`${AUTH_SETUP_PASSWORD_PATH}?error=invalid`, origin));
  }

  if (!code) {
    // Implicit-flow tokens live in the URL hash and are invisible to the server.
    return htmlHashForward();
  }

  const { supabase, state } = await createCallbackSupabase(request);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  let userId: string | null = null;
  let roleHref: string | null = null;
  if (!error) {
    const resolved = await resolveRoleHref(supabase);
    userId = resolved.userId;
    roleHref = resolved.roleHref;
  }

  console.info("[auth/callback]", {
    codePresent: true,
    exchangeOk: !error,
    exchangeErrorName: error?.name ?? null,
    authenticatedUser: Boolean(userId),
  });

  const destination = mapAuthCallbackDestination({
    type,
    next,
    exchangeOk: !error,
    roleHref,
  });

  const response = NextResponse.redirect(new URL(destination.path, origin));
  return applyCookiesToRedirect(response, state);
}

type ImplicitHandoffBody = {
  access_token?: unknown;
  refresh_token?: unknown;
  type?: unknown;
};

const MAX_TOKEN_CHARS = 16_384;

function readToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (!token || token.length > MAX_TOKEN_CHARS) return null;
  return token;
}

/**
 * Implicit-flow handoff: browser posts hash tokens so SSR cookies can be written
 * before /auth/setup-password runs getUser().
 */
export async function POST(request: NextRequest) {
  let body: ImplicitHandoffBody;
  try {
    body = (await request.json()) as ImplicitHandoffBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid" },
      { status: 400, headers: AUTH_CALLBACK_CACHE_HEADERS },
    );
  }

  const accessToken = readToken(body.access_token);
  const refreshToken = readToken(body.refresh_token);
  const type = typeof body.type === "string" ? body.type : null;

  if (!accessToken || !refreshToken) {
    console.info("[auth/callback]", {
      codePresent: false,
      implicitHandoff: false,
      authenticatedUser: false,
    });
    return NextResponse.json(
      { ok: false, error: "invalid" },
      { status: 400, headers: AUTH_CALLBACK_CACHE_HEADERS },
    );
  }

  const { supabase, state } = await createCallbackSupabase(request);
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  let userId: string | null = null;
  let roleHref: string | null = null;
  if (!error) {
    const resolved = await resolveRoleHref(supabase);
    userId = resolved.userId;
    roleHref = resolved.roleHref;
  }

  console.info("[auth/callback]", {
    codePresent: false,
    implicitHandoff: true,
    exchangeOk: !error,
    exchangeErrorName: error?.name ?? null,
    authenticatedUser: Boolean(userId),
  });

  const destination = mapAuthCallbackDestination({
    type,
    next: AUTH_SETUP_PASSWORD_PATH,
    exchangeOk: !error,
    roleHref,
  });

  const response = NextResponse.json(
    { ok: destination.kind !== "invalid", next: destination.path },
    { status: destination.kind === "invalid" ? 401 : 200 },
  );
  return applyCookiesToRedirect(response, state);
}
