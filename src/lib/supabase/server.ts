import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

/**
 * Server-side Supabase via `createServerClient` from `@supabase/ssr`.
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Cookie writes fail in pure Server Components (by design); session refresh is handled in `src/middleware.ts`.
 */
export async function createServerSupabaseClient() {
  const { url, anonKey } = getSupabaseUrlAndAnonKey();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component render path cannot mutate cookies; middleware refreshes the session.
        }
      },
    },
  });
}
