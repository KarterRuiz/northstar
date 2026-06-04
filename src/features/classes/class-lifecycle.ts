import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { CLASS_HAS_RECORDS_MESSAGE } from "./constants";

export { CLASS_DELETE_CONFIRM_HINT, CLASS_HAS_RECORDS_MESSAGE } from "./constants";

export type ClassDeletableCheck =
  | { ok: true; deletable: true }
  | { ok: true; deletable: false; reason: typeof CLASS_HAS_RECORDS_MESSAGE }
  | { ok: false; error: string };

export async function checkClassDeletable(
  supabase: SupabaseClient<Database>,
  classId: string,
): Promise<ClassDeletableCheck> {
  const { data, error } = await supabase.rpc("class_is_deletable", {
    p_class_id: classId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data === true) {
    return { ok: true, deletable: true };
  }

  return { ok: true, deletable: false, reason: CLASS_HAS_RECORDS_MESSAGE };
}
