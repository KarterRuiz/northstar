"use server";

import { revalidatePath } from "next/cache";

import { canEditSchoolSettings, isRole, type Role } from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";
import {
  MAX_SCHOOL_LOGO_BYTES,
  SCHOOL_LOGOS_BUCKET,
  SCHOOL_SETTINGS_ID,
} from "@/lib/school-settings/constants";
import {
  isValidHexColor,
  normalizeOptionalHexColor,
  resolveLogoExtension,
} from "@/lib/school-settings/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  logSchoolSettingsError,
  schoolSettingsDbErrorMessage,
} from "./safe-admin-error";

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

function parseDashboardRole(
  formData: FormData,
): { ok: true; dashboardRole: Role } | { ok: false; message: string } {
  const roleRaw = String(formData.get("dashboardRole") ?? "");
  if (!isRole(roleRaw)) {
    return { ok: false, message: "Invalid workspace." };
  }
  return { ok: true, dashboardRole: roleRaw as Role };
}

function pickText(formData: FormData, key: string, maxLen: number): string {
  return String(formData.get(key) ?? "").trim().slice(0, maxLen);
}

function revalidateSchoolSettingsPaths(dashboardRole: Role) {
  revalidatePath(`/dashboard/${dashboardRole}/school-settings`, "page");
  revalidatePath("/dashboard/teacher/report-cards/preview", "layout");
}

function parseHexColorField(
  formData: FormData,
  key: string,
  fallback: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const raw = pickText(formData, key, 7);
  if (!isValidHexColor(raw)) {
    return {
      ok: false,
      message: "Colors must be a 6-digit hex value (#RRGGBB).",
    };
  }
  return { ok: true, value: normalizeOptionalHexColor(raw) || fallback };
}

function failSettings(
  scope: string,
  detail: string,
  fallback: string,
): { ok: false; message: string } {
  logSchoolSettingsError(scope, detail);
  return {
    ok: false,
    message: schoolSettingsDbErrorMessage(detail, fallback),
  };
}

export async function updateSchoolInstitutionDetailsAction(
  _prev: SchoolSettingsMutationState | undefined,
  formData: FormData,
): Promise<SchoolSettingsMutationState> {
  const parsedRole = parseDashboardRole(formData);
  if (!parsedRole.ok) return parsedRole;
  const { dashboardRole } = parsedRole;

  const gate = await assertCanEditSchoolSettings(dashboardRole);
  if (!gate.ok) return gate;

  const schoolName = pickText(formData, "schoolName", 200);
  const schoolAddress = pickText(formData, "schoolAddress", 500);
  const schoolPhone = pickText(formData, "schoolPhone", 40);
  const schoolEmail = pickText(formData, "schoolEmail", 200);
  const website = pickText(formData, "website", 300);
  const principalName = pickText(formData, "principalName", 200);

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return failSettings(
      "updateInstitution",
      "Supabase is not configured",
      "Institution details could not be saved. Try again.",
    );
  }

  const { error } = await supabase
    .from("school_settings")
    .update({
      school_name: schoolName,
      school_address: schoolAddress,
      school_phone: schoolPhone,
      school_email: schoolEmail,
      website,
      principal_name: principalName,
    })
    .eq("id", SCHOOL_SETTINGS_ID);

  if (error) {
    return failSettings(
      "updateInstitution",
      error.message,
      "Institution details could not be saved. Try again.",
    );
  }

  revalidateSchoolSettingsPaths(dashboardRole);
  return { ok: true, message: "Institution details saved." };
}

/** Branding colors only — logo and footer save via their own actions. */
export async function updateSchoolBrandingSettingsAction(
  _prev: SchoolSettingsMutationState | undefined,
  formData: FormData,
): Promise<SchoolSettingsMutationState> {
  const parsedRole = parseDashboardRole(formData);
  if (!parsedRole.ok) return parsedRole;
  const { dashboardRole } = parsedRole;

  const gate = await assertCanEditSchoolSettings(dashboardRole);
  if (!gate.ok) return gate;

  const primaryParsed = parseHexColorField(formData, "primaryColor", "#1e3a5f");
  if (!primaryParsed.ok) return primaryParsed;
  const secondaryParsed = parseHexColorField(formData, "secondaryColor", "#4a6fa5");
  if (!secondaryParsed.ok) return secondaryParsed;

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return failSettings(
      "updateBranding",
      "Supabase is not configured",
      "Branding could not be saved. Try again.",
    );
  }

  const { error } = await supabase
    .from("school_settings")
    .update({
      primary_color: primaryParsed.value,
      secondary_color: secondaryParsed.value,
    })
    .eq("id", SCHOOL_SETTINGS_ID);

  if (error) {
    return failSettings(
      "updateBranding",
      error.message,
      "Branding could not be saved. Try again.",
    );
  }

  revalidateSchoolSettingsPaths(dashboardRole);
  return { ok: true, message: "Branding colors saved." };
}

/** Report-card footer only — keeps document save independent of colors/logo. */
export async function updateSchoolOfficialDocumentsAction(
  _prev: SchoolSettingsMutationState | undefined,
  formData: FormData,
): Promise<SchoolSettingsMutationState> {
  const parsedRole = parseDashboardRole(formData);
  if (!parsedRole.ok) return parsedRole;
  const { dashboardRole } = parsedRole;

  const gate = await assertCanEditSchoolSettings(dashboardRole);
  if (!gate.ok) return gate;

  const reportCardFooter = pickText(formData, "reportCardFooter", 2000);

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return failSettings(
      "updateOfficialDocuments",
      "Supabase is not configured",
      "Official documents could not be saved. Try again.",
    );
  }

  const { error } = await supabase
    .from("school_settings")
    .update({
      report_card_footer: reportCardFooter,
    })
    .eq("id", SCHOOL_SETTINGS_ID);

  if (error) {
    return failSettings(
      "updateOfficialDocuments",
      error.message,
      "Official documents could not be saved. Try again.",
    );
  }

  revalidateSchoolSettingsPaths(dashboardRole);
  return { ok: true, message: "Official documents saved." };
}

export async function uploadSchoolLogoAction(
  _prev: SchoolSettingsMutationState | undefined,
  formData: FormData,
): Promise<SchoolSettingsMutationState> {
  const parsedRole = parseDashboardRole(formData);
  if (!parsedRole.ok) return parsedRole;
  const { dashboardRole } = parsedRole;

  const gate = await assertCanEditSchoolSettings(dashboardRole);
  if (!gate.ok) return gate;

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image file to upload." };
  }

  if (file.size > MAX_SCHOOL_LOGO_BYTES) {
    return { ok: false, message: "Logo must be 2 MB or smaller." };
  }

  const ext = resolveLogoExtension(file);
  if (!ext) {
    return {
      ok: false,
      message: "Logo must be PNG, JPEG, WebP, or SVG.",
    };
  }

  const contentType =
    file.type ||
    ({
      png: "image/png",
      jpg: "image/jpeg",
      webp: "image/webp",
      svg: "image/svg+xml",
    }[ext] as string);

  const storagePath = `logo.${ext}`;
  const buffer = await file.arrayBuffer();

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return failSettings(
      "uploadLogo",
      "Supabase is not configured",
      "Logo could not be uploaded. Try again.",
    );
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
      contentType,
      upsert: true,
    });

  if (uploadError) {
    return failSettings(
      "uploadLogo.storage",
      uploadError.message,
      "Logo could not be uploaded. Try again.",
    );
  }

  const { error: updateError } = await supabase
    .from("school_settings")
    .update({ logo_storage_path: storagePath })
    .eq("id", SCHOOL_SETTINGS_ID);

  if (updateError) {
    await supabase.storage.from(SCHOOL_LOGOS_BUCKET).remove([storagePath]);
    return failSettings(
      "uploadLogo.update",
      updateError.message,
      "Logo could not be saved. Try again.",
    );
  }

  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(SCHOOL_LOGOS_BUCKET).remove([previousPath]);
  }

  revalidateSchoolSettingsPaths(dashboardRole);
  return { ok: true, message: "School logo updated." };
}

export async function removeSchoolLogoAction(
  _prev: SchoolSettingsMutationState | undefined,
  formData: FormData,
): Promise<SchoolSettingsMutationState> {
  const parsedRole = parseDashboardRole(formData);
  if (!parsedRole.ok) return parsedRole;
  const { dashboardRole } = parsedRole;

  const gate = await assertCanEditSchoolSettings(dashboardRole);
  if (!gate.ok) return gate;

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return failSettings(
      "removeLogo",
      "Supabase is not configured",
      "Logo could not be removed. Try again.",
    );
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
    return failSettings(
      "removeLogo",
      updateError.message,
      "Logo could not be removed. Try again.",
    );
  }

  if (previousPath) {
    await supabase.storage.from(SCHOOL_LOGOS_BUCKET).remove([previousPath]);
  }

  revalidateSchoolSettingsPaths(dashboardRole);
  return { ok: true, message: "School logo removed." };
}
