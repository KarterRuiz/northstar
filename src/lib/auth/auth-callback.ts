/**
 * Pure helpers for /auth/callback PKCE + implicit-hash session handoff.
 * Safe to import from client components (no server-only deps).
 */

export const AUTH_CALLBACK_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
} as const;

const AUTH_HASH_TOKEN_RE =
  /access_token|refresh_token|type=recovery|type=invite|type=signup|type=magiclink/;

export type ImplicitAuthTokens = {
  accessToken: string;
  refreshToken: string;
  type: string | null;
};

export type AuthCookieWriteOptions = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

export type PendingAuthCookie = {
  name: string;
  value: string;
  options?: AuthCookieWriteOptions;
};

export function hashLooksLikeAuthCallback(hash: string): boolean {
  return AUTH_HASH_TOKEN_RE.test(hash);
}

/**
 * Parse implicit-flow tokens from a URL hash (`#access_token=...&refresh_token=...`).
 * Returns null when either token is missing. Never logs token values.
 */
export function parseImplicitAuthHash(hash: string): ImplicitAuthTokens | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.trim()) return null;

  const params = new URLSearchParams(raw);
  const accessToken = params.get("access_token")?.trim() ?? "";
  const refreshToken = params.get("refresh_token")?.trim() ?? "";
  if (!accessToken || !refreshToken) return null;

  const type = params.get("type")?.trim().toLowerCase() || null;
  return { accessToken, refreshToken, type };
}

export function isHttpsRequest(input: {
  protocol?: string | null;
  forwardedProto?: string | null;
}): boolean {
  if ((input.protocol ?? "").replace(/:$/, "").toLowerCase() === "https") return true;
  const forwarded = (input.forwardedProto ?? "").split(",")[0]?.trim().toLowerCase();
  return forwarded === "https";
}

/**
 * Pick only Next.js-supported cookie fields. Drop functions like `encode`
 * that cause `cookies().set` / `NextResponse.cookies.set` to fail silently.
 */
export function sanitizeAuthCookieWriteOptions(
  options: unknown,
  requestIsHttps: boolean,
): AuthCookieWriteOptions {
  const src =
    options && typeof options === "object" ? (options as Record<string, unknown>) : {};

  const sameSiteRaw = src.sameSite;
  const sameSite: AuthCookieWriteOptions["sameSite"] =
    sameSiteRaw === "lax" || sameSiteRaw === "strict" || sameSiteRaw === "none"
      ? sameSiteRaw
      : "lax";

  const expires =
    src.expires instanceof Date
      ? src.expires
      : typeof src.expires === "string" || typeof src.expires === "number"
        ? new Date(src.expires)
        : undefined;

  return {
    path: typeof src.path === "string" && src.path ? src.path : "/",
    domain: typeof src.domain === "string" && src.domain ? src.domain : undefined,
    maxAge: typeof src.maxAge === "number" && Number.isFinite(src.maxAge) ? src.maxAge : undefined,
    expires: expires && !Number.isNaN(expires.getTime()) ? expires : undefined,
    httpOnly: typeof src.httpOnly === "boolean" ? src.httpOnly : undefined,
    secure: requestIsHttps ? true : typeof src.secure === "boolean" ? src.secure : false,
    sameSite,
  };
}

export function accumulateAuthCookies(
  existing: PendingAuthCookie[],
  cookiesToSet: { name: string; value: string; options?: unknown }[],
  requestIsHttps: boolean,
): PendingAuthCookie[] {
  const next = existing.slice();
  for (const cookie of cookiesToSet) {
    if (!cookie.name) continue;
    next.push({
      name: cookie.name,
      value: cookie.value,
      options: sanitizeAuthCookieWriteOptions(cookie.options, requestIsHttps),
    });
  }
  return next;
}
