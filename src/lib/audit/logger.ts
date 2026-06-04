import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

import type { AuditEventInput } from "./types";

export type RecordAuditEventOptions = {
  /**
   * When true, database / configuration failures throw instead of being swallowed.
   * Default false: observability must not break primary flows.
   */
  strict?: boolean;
};

function metadataToJson(metadata: AuditEventInput["metadata"]): Json {
  return JSON.parse(JSON.stringify(metadata)) as Json;
}

function warnDev(message: string, detail?: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[audit] ${message}`, detail ?? "");
  }
}

/**
 * Persists an audit row when Supabase is configured; otherwise logs in development.
 * Never throws unless `strict` is true.
 */
export async function recordAuditEvent(
  event: AuditEventInput,
  options?: RecordAuditEventOptions,
): Promise<void> {
  const strict = options?.strict === true;

  if (!isSupabaseConfigured()) {
    warnDev("Supabase not configured; skipping audit insert", { action: event.action });
    if (strict) {
      throw new Error(
        "Audit strict mode requires Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      );
    }
    return;
  }

  const supabase = await createServerSupabaseClient();

  const row = {
    action: event.action,
    actor_id: event.actorUserId ?? null,
    metadata: metadataToJson(event.metadata),
    ...(event.createdAt ? { created_at: event.createdAt } : {}),
  };

  const { error } = await supabase.from("audit_events").insert(row);

  if (error) {
    warnDev(`audit insert failed: ${error.message}`, { action: event.action, code: error.code });
    if (strict) {
      throw error;
    }
  }
}
