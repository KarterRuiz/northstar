import "server-only";

import { SCHOOL_SETTINGS_ID } from "@/lib/school-settings/constants";
import type { SchoolSettingsRow } from "@/lib/school-settings/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { mapSchoolSettingsRow } from "./map-school-settings-row";

export type LoadSchoolSettingsResult =
  | { ok: true; settings: SchoolSettingsRow }
  | { ok: false; message: string };

export async function loadSchoolSettings(): Promise<LoadSchoolSettingsResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: "Supabase is not configured.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("school_settings")
    .select(
      "id, school_name, logo_storage_path, school_address, school_phone, school_email, website, primary_color, secondary_color, report_card_footer, principal_name, created_at, updated_at",
    )
    .eq("id", SCHOOL_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message || "Could not load school settings." };
  }

  if (!data) {
    return { ok: false, message: "School settings are not initialized." };
  }

  return { ok: true, settings: mapSchoolSettingsRow(data) };
}
