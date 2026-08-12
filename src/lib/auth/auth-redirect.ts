/**
 * Safe internal destinations for Auth email callbacks.
 * Never trust arbitrary `next` values from email links or query strings.
 */

export const AUTH_SETUP_PASSWORD_PATH = "/auth/setup-password";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_FORGOT_PASSWORD_PATH = "/auth/forgot-password";
export const LOGIN_PATH = "/login";

const DASHBOARD_PREFIX = "/dashboard/";

function stripHash(path: string): string {
  const hashAt = path.indexOf("#");
  return hashAt === -1 ? path : path.slice(0, hashAt);
}

function decodeOnce(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function isSafeInternalPath(raw: string): boolean {
  const path = stripHash(raw.trim());
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//") || path.startsWith("/\\")) return false;
  if (path.includes("://") || path.includes("\\") || path.includes("@")) return false;
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(path)) return false;
  return true;
}

export function isPasswordSetupPath(path: string): boolean {
  const clean = stripHash(path.trim());
  return clean === AUTH_SETUP_PASSWORD_PATH || clean.startsWith(`${AUTH_SETUP_PASSWORD_PATH}?`);
}

/** True for the PKCE/implicit auth callback route (middleware must not rewrite its cookies). */
export function isAuthCallbackPath(pathname: string): boolean {
  const clean = stripHash(pathname.trim()).replace(/\/+$/, "");
  return clean === AUTH_CALLBACK_PATH;
}

/**
 * Setup-password renders the form when Auth already has a user.
 * Do not require a local cookie or PASSWORD_RECOVERY client event.
 */
export function setupPasswordShouldRenderForm(input: {
  authenticated: boolean;
  linkError: boolean;
}): boolean {
  if (input.authenticated) return true;
  if (input.linkError) return false;
  return false;
}

/**
 * Allowlist-only `next` parser. Falls back when the value is missing or unsafe.
 */
export function sanitizeAuthNextPath(
  raw: string | null | undefined,
  fallback: string = AUTH_SETUP_PASSWORD_PATH,
): string {
  if (!raw?.trim()) return fallback;
  const decoded = stripHash(decodeOnce(raw.trim()));
  if (!isSafeInternalPath(decoded)) return fallback;

  if (
    decoded === LOGIN_PATH ||
    decoded.startsWith(`${LOGIN_PATH}?`) ||
    isPasswordSetupPath(decoded) ||
    decoded.startsWith(DASHBOARD_PREFIX) ||
    decoded === AUTH_FORGOT_PASSWORD_PATH ||
    decoded.startsWith(`${AUTH_FORGOT_PASSWORD_PATH}?`)
  ) {
    return decoded;
  }

  return fallback;
}

export type AuthCallbackIntent = "setup" | "recovery" | "generic";

export type AuthCallbackDestination =
  | { kind: "setup_password"; path: string; intent: AuthCallbackIntent }
  | { kind: "workspace"; path: string }
  | { kind: "login"; path: string }
  | { kind: "invalid"; path: string };

function setupPasswordPath(intent: AuthCallbackIntent): string {
  if (intent === "generic") return AUTH_SETUP_PASSWORD_PATH;
  return `${AUTH_SETUP_PASSWORD_PATH}?intent=${intent}`;
}

/**
 * Maps PKCE/callback query params (+ optional known role href) to a safe in-app destination.
 * Invite, recovery, and signup always go to password setup — never Sign In.
 */
export function mapAuthCallbackDestination(input: {
  type?: string | null;
  next?: string | null;
  exchangeOk: boolean;
  roleHref?: string | null;
}): AuthCallbackDestination {
  if (!input.exchangeOk) {
    return { kind: "invalid", path: `${AUTH_SETUP_PASSWORD_PATH}?error=invalid` };
  }

  const type = (input.type ?? "").trim().toLowerCase();
  const next = sanitizeAuthNextPath(input.next, AUTH_SETUP_PASSWORD_PATH);

  const isEmailSetupType =
    type === "recovery" ||
    type === "invite" ||
    type === "signup" ||
    type === "magiclink" ||
    type === "email";

  if (isEmailSetupType || isPasswordSetupPath(next) || !input.next?.trim()) {
    const intent: AuthCallbackIntent =
      type === "recovery"
        ? "recovery"
        : type === "invite" || type === "signup"
          ? "setup"
          : "generic";
    return { kind: "setup_password", path: setupPasswordPath(intent), intent };
  }

  if (
    input.roleHref &&
    isSafeInternalPath(input.roleHref) &&
    input.roleHref.startsWith(DASHBOARD_PREFIX)
  ) {
    return { kind: "workspace", path: stripHash(input.roleHref) };
  }

  if (next.startsWith(DASHBOARD_PREFIX)) {
    return { kind: "workspace", path: next };
  }

  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`)) {
    return { kind: "login", path: next };
  }

  return { kind: "setup_password", path: AUTH_SETUP_PASSWORD_PATH, intent: "generic" };
}

export function setupPasswordCopy(intent: string | null | undefined): {
  title: string;
  subtitle: string;
} {
  if (intent === "recovery") {
    return {
      title: "Create a new password",
      subtitle: "Choose a secure password you’ll use to sign in to NorthStar.",
    };
  }
  if (intent === "setup") {
    return {
      title: "Finish setting up your account.",
      subtitle: "Choose a secure password you’ll use to sign in to NorthStar.",
    };
  }
  return {
    title: "Set your NorthStar password",
    subtitle: "Choose a secure password you’ll use to sign in to NorthStar.",
  };
}
