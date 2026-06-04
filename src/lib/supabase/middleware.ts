import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

/**
 * Refreshes the Supabase session from cookies and returns clients + `NextResponse`
 * for use in root `middleware.ts`. Call `getUser()` on the client before sending the response.
 */
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabaseUrlAndAnonKey();

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        for (const [key, value] of Object.entries(responseHeaders)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  return { supabase, response };
}
