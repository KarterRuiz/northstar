import "server-only";

import { SCHOOL_SETTINGS_ID } from "@/lib/school-settings/constants";
import type { SchoolSettingsRow } from "@/lib/school-settings/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { mapSchoolSettingsRow } from "./map-school-settings-row";
import { logSchoolSettingsError } from "./safe-admin-error";

export type LoadSchoolSettingsResult =
  | { ok: true; settings: SchoolSettingsRow }
  | { ok: false; message: string };

const SCHOOL_SETTINGS_LOAD_ERROR =
  "School settings could not be loaded. Try again.";

export async function loadSchoolSettings(): Promise<LoadSchoolSettingsResult> {
  if (!isSupabaseConfigured()) {
    logSchoolSettingsError("loadSchoolSettings", "Supabase is not configured");
    return { ok: false, message: SCHOOL_SETTINGS_LOAD_ERROR };
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
    logSchoolSettingsError("loadSchoolSettings", error.message);
    return { ok: false, message: SCHOOL_SETTINGS_LOAD_ERROR };
  }

  if (!data) {
    logSchoolSettingsError("loadSchoolSettings", "School settings row missing");
    return {
      ok: false,
      message: "School settings are not initialized. Contact support if this continues.",
    };
  }

  return { ok: true, settings: mapSchoolSettingsRow(data) };
}
