"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

/** Browser Supabase client for Client Components. */
export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabaseUrlAndAnonKey();
  return createBrowserClient<Database>(url, anonKey);
}
