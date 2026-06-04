"use server";

import { revalidatePath } from "next/cache";

import { canEditSchoolSettings, isRole, type Role } from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";
import {
  SCHOOL_LOGOS_BUCKET,
  SCHOOL_SETTINGS_ID,
} from "@/lib/school-settings/constants";
import {
  extensionForLogoMime,
  isValidHexColor,
  normalizeOptionalHexColor,
} from "@/lib/school-settings/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SchoolSettingsMutationState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

async function assertCanEditSchoolSettings(
  dashboardRole: Role,
): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  if (!canEditSchoolSettings(dashboardRole)) {
    return { ok: false, message: "You do not have permission to edit school settings." };
  }

  const user = await getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }

  const profileRole = await getProfileRole(user.id);
  if (!profileRole || profileRole !== dashboardRole) {
    return { ok: false, message: "Workspace does not match your account role." };
  }

  return { ok: true, userId: user.id };
}

function pickText(formData: FormData, key: string, maxLen: number): string {
  return String(formData.get(key) ?? "").trim().slice(0, maxLen);
}

export async function updateSchoolSettingsAction(
  _prev: SchoolSettingsMutationState | undefined,
  formData: FormData,
): Promise<SchoolSettingsMutationState> {
  const roleRaw = String(formData.get("dashboardRole") ?? "");
  if (!isRole(roleRaw)) {
    return { ok: false, message: "Invalid workspace." };
  }
  const dashboardRole = roleRaw as Role;

  const gate = await assertCanEditSchoolSettings(dashboardRole);
  if (!gate.ok) return gate;

  const schoolName = pickText(formData, "schoolName", 200);
  const schoolAddress = pickText(formData, "schoolAddress", 500);
  const schoolPhone = pickText(formData, "schoolPhone", 40);
  const schoolEmail = pickText(formData, "schoolEmail", 200);
  const website = pickText(formData, "website", 300);
  const reportCardFooter = pickText(formData, "reportCardFooter", 2000);
  const principalName = pickText(formData, "principalName", 200);

  const primaryColorRaw = pickText(formData, "primaryColor", 7);
  const secondaryColorRaw = pickText(formData, "secondaryColor", 7);
  if (!isValidHexColor(primaryColorRaw) || !isValidHexColor(secondaryColorRaw)) {
    return { ok: false, message: "Colors must be empty or a 6-digit hex value (#RRGGBB)." };
  }
  const primaryColor = normalizeOptionalHexColor(primaryColorRaw) || "#1e3a5f";
  const secondaryColor = normalizeOptionalHexColor(secondaryColorRaw) || "#4a6fa5";

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const { error } = await supabase
    .from("school_settings")
    .update({
      school_name: schoolName,
      school_address: schoolAddress,
      school_phone: schoolPhone,
      school_email: schoolEmail,
      website,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      report_card_footer: reportCardFooter,
      principal_name: principalName,
    })
    .eq("id", SCHOOL_SETTINGS_ID);

  if (error) {
    return { ok: false, message: error.message || "Could not save settings." };
  }

  revalidatePath(`/dashboard/${dashboardRole}/school-settings`, "page");
  revalidatePath("/dashboard/teacher/report-cards/preview", "layout");

  return { ok: true, message: "School settings saved." };
}

export async function uploadSchoolLogoAction(
  _prev: SchoolSettingsMutationState | undefined,
  formData: FormData,
): Promise<SchoolSettingsMutationState> {
  const roleRaw = String(formData.get("dashboardRole") ?? "");
  if (!isRole(roleRaw)) {
    return { ok: false, message: "Invalid workspace." };
  }
  const dashboardRole = roleRaw as Role;

  const gate = await assertCanEditSchoolSettings(dashboardRole);
  if (!gate.ok) return gate;

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image file to upload." };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, message: "Logo must be 2 MB or smaller." };
  }

  const ext = extensionForLogoMime(file.type);
  if (!ext) {
    return {
      ok: false,
      message: "Logo must be PNG, JPEG, WebP, or SVG.",
    };
  }

  const storagePath = `logo.${ext}`;
  const buffer = await file.arrayBuffer();

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const { data: existing } = await supabase
    .from("school_settings")
    .select("logo_storage_path")
    .eq("id", SCHOOL_SETTINGS_ID)
    .maybeSingle();

  const previousPath = (existing as { logo_storage_path?: string | null } | null)
    ?.logo_storage_path;

  const { error: uploadError } = await supabase.storage
    .from(SCHOOL_LOGOS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, message: uploadError.message || "Logo upload failed." };
  }

  const { error: updateError } = await supabase
    .from("school_settings")
    .update({ logo_storage_path: storagePath })
    .eq("id", SCHOOL_SETTINGS_ID);

  if (updateError) {
    await supabase.storage.from(SCHOOL_LOGOS_BUCKET).remove([storagePath]);
    return { ok: false, message: updateError.message || "Could not save logo path." };
  }

  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(SCHOOL_LOGOS_BUCKET).remove([previousPath]);
  }

  revalidatePath(`/dashboard/${dashboardRole}/school-settings`, "page");
  revalidatePath("/dashboard/teacher/report-cards/preview", "layout");

  return { ok: true, message: "School logo updated." };
}

export async function removeSchoolLogoAction(
  _prev: SchoolSettingsMutationState | undefined,
  formData: FormData,
): Promise<SchoolSettingsMutationState> {
  const roleRaw = String(formData.get("dashboardRole") ?? "");
  if (!isRole(roleRaw)) {
    return { ok: false, message: "Invalid workspace." };
  }
  const dashboardRole = roleRaw as Role;

  const gate = await assertCanEditSchoolSettings(dashboardRole);
  if (!gate.ok) return gate;

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const { data: existing } = await supabase
    .from("school_settings")
    .select("logo_storage_path")
    .eq("id", SCHOOL_SETTINGS_ID)
    .maybeSingle();

  const previousPath = (existing as { logo_storage_path?: string | null } | null)
    ?.logo_storage_path;

  const { error: updateError } = await supabase
    .from("school_settings")
    .update({ logo_storage_path: null })
    .eq("id", SCHOOL_SETTINGS_ID);

  if (updateError) {
    return { ok: false, message: updateError.message || "Could not remove logo." };
  }

  if (previousPath) {
    await supabase.storage.from(SCHOOL_LOGOS_BUCKET).remove([previousPath]);
  }

  revalidatePath(`/dashboard/${dashboardRole}/school-settings`, "page");
  revalidatePath("/dashboard/teacher/report-cards/preview", "layout");

  return { ok: true, message: "School logo removed." };
}
