import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

/** Base64url-decode a JWT payload segment and return the `role` claim, if any. Never throws. */
function readJwtPayloadRoleFromSegment(payloadSegment: string): string | null {
  try {
    const b64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const json = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Rejects obvious misconfiguration (anon key pasted as service key) without logging or echoing secrets.
 */
function assertServiceRoleKeyShape(serviceKey: string): void {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anonKey && serviceKey === anonKey) {
    throw new Error(
      "Server API key matches the publishable anon key. Use the service_role secret from Supabase (Dashboard → Project Settings → API), not NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  if (serviceKey.startsWith("eyJ")) {
    const parts = serviceKey.split(".");
    if (parts.length >= 2) {
      const role = readJwtPayloadRoleFromSegment(parts[1]!);
      if (role === "anon") {
        throw new Error(
          "Server API key appears to be a publishable (anon) JWT, not service_role. Use the service_role secret from Supabase (Dashboard → Project Settings → API).",
        );
      }
    }
  }
}

/**
 * Supabase client with the service role key. **Server-only** — never import from client components.
 * Uses `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` only (never `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
 *
 * **Env reload:** Next.js reads `process.env` when the dev server starts. After editing `.env.local`,
 * restart `next dev` (or the production Node process) so a new key is picked up.
 */
export function createAdminSupabaseClient() {
  const { url } = getSupabaseUrlAndAnonKey();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY (server-only; never expose to the client).",
    );
  }

  assertServiceRoleKeyShape(serviceKey);

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
