import {
  AUTH_CALLBACK_PATH,
  AUTH_SETUP_PASSWORD_PATH,
  LOGIN_PATH,
} from "@/lib/auth/auth-redirect";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export function getSupabaseUrlAndAnonKey(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return { url, anonKey };
}

/**
 * True when this process should never fall back to localhost for absolute app URLs.
 * Covers `next start` / Vercel Production / Vercel Preview.
 */
function isDeployedOrProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    return true;
  }
  if (process.env.VERCEL === "1" && process.env.NODE_ENV === "production") {
    return true;
  }
  return process.env.NODE_ENV === "production";
}

/**
 * Normalize a configured host or origin into an absolute origin (no trailing slash).
 * Ensures https for non-localhost hosts.
 */
function normalizeSiteOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) {
    throw new Error("Empty site URL");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  const host = url.hostname.toLowerCase();
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]";

  if (!isLocal && url.protocol === "http:") {
    url.protocol = "https:";
  }

  return url.origin;
}

/**
 * Canonical public origin for this deployment.
 *
 * Priority:
 * 1. `NEXT_PUBLIC_SITE_URL` (preferred explicit config)
 * 2. `NEXT_PUBLIC_VERCEL_URL` (if set)
 * 3. `VERCEL_URL` (auto-set by Vercel; server-only — never expose secrets)
 * 4. `http://localhost:3000` only for local `npm run dev`
 *
 * Production / Preview never fall back to localhost.
 */
export function getCanonicalSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return normalizeSiteOrigin(siteUrl);
  }

  const publicVercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (publicVercelUrl) {
    return normalizeSiteOrigin(publicVercelUrl);
  }

  // Vercel sets VERCEL_URL automatically (host only, no protocol). Safe for server actions.
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return normalizeSiteOrigin(vercelUrl);
  }

  if (!isDeployedOrProductionRuntime()) {
    return "http://localhost:3000";
  }

  throw new Error(
    "NEXT_PUBLIC_SITE_URL is required in production for absolute application URLs (auth email redirects). Set it to https://northstar-roan.vercel.app (or your production domain).",
  );
}

/**
 * Absolute `/login` URL for copied NorthStar invite hint links (`staff_invite` token).
 * Auth emails must use {@link getAuthEmailRedirectToSetupPassword} instead.
 */
export function getAuthEmailRedirectToLogin(): string {
  return `${getCanonicalSiteUrl()}${LOGIN_PATH}`;
}

/**
 * Canonical `redirectTo` for `inviteUserByEmail` and `resetPasswordForEmail`.
 * Goes through `/auth/callback` (PKCE exchange) then `/auth/setup-password`.
 *
 * Supabase dashboard requirement (Invite user template must match Reset password):
 * the CTA must use `{{ .ConfirmationURL }}` (not bare `{{ .SiteURL }}`). Otherwise
 * the invite button opens the public homepage and never establishes an invite session.
 * Allowlist must include this exact callback origin path (query string optional via `**`).
 */
export function getAuthEmailRedirectToSetupPassword(): string {
  const next = encodeURIComponent(AUTH_SETUP_PASSWORD_PATH);
  return `${getCanonicalSiteUrl()}${AUTH_CALLBACK_PATH}?next=${next}`;
}

/**
 * Invite/setup email redirect + copied NorthStar invite-link base.
 * Never hard-code hosts; production uses NEXT_PUBLIC_SITE_URL / Vercel URL.
 */
export function resolveStaffAuthUrls():
  | { ok: true; redirectTo: string; inviteLinkBase: string }
  | { ok: false; message: string } {
  try {
    return {
      ok: true,
      redirectTo: getAuthEmailRedirectToSetupPassword(),
      inviteLinkBase: getAuthEmailRedirectToLogin(),
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid site URL configuration.",
    };
  }
}
