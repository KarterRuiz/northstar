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
 * Absolute `/login` URL for Auth email actions (`inviteUserByEmail`, etc.).
 * Production must set `NEXT_PUBLIC_SITE_URL`; dev falls back to localhost only outside production.
 */
export function getAuthEmailRedirectToLogin(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (base) {
    return `${base.replace(/\/$/, "")}/login`;
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000/login";
  }
  throw new Error(
    "NEXT_PUBLIC_SITE_URL is required in production for Supabase auth email redirects.",
  );
}
