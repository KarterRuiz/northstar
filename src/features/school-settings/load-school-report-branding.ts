import "server-only";

import {
  REPORT_CARD_SCHOOL_NAME_FALLBACK,
  SCHOOL_LOGOS_BUCKET,
} from "@/lib/school-settings/constants";
import type { SchoolReportBranding } from "@/lib/school-settings/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type BrandingRpcRow = {
  school_name: string;
  logo_storage_path: string | null;
  school_address: string;
  school_phone: string;
  school_email: string;
  website: string;
  primary_color: string;
  secondary_color: string;
  report_card_footer: string;
  principal_name: string;
};

const EMPTY_BRANDING: SchoolReportBranding = {
  schoolName: REPORT_CARD_SCHOOL_NAME_FALLBACK,
  logoStoragePath: null,
  logoSignedUrl: null,
  schoolAddress: "",
  schoolPhone: "",
  schoolEmail: "",
  website: "",
  primaryColor: "#1e3a5f",
  secondaryColor: "#4a6fa5",
  reportCardFooter: "",
  principalName: "",
  isConfigured: false,
};

function brandingIsConfigured(row: BrandingRpcRow): boolean {
  return Boolean(
    row.school_name?.trim() ||
      row.logo_storage_path?.trim() ||
      row.school_address?.trim() ||
      row.report_card_footer?.trim() ||
      row.principal_name?.trim(),
  );
}

/**
 * Branding for printable report cards. Uses a security-definer RPC so teachers
 * can preview without direct `school_settings` SELECT.
 */
export async function loadSchoolReportBranding(): Promise<SchoolReportBranding> {
  if (!isSupabaseConfigured()) {
    return EMPTY_BRANDING;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("school_settings_report_branding");

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return EMPTY_BRANDING;
  }

  const row = data[0] as BrandingRpcRow;
  const schoolName = row.school_name?.trim() || REPORT_CARD_SCHOOL_NAME_FALLBACK;
  const logoPath = row.logo_storage_path?.trim() || null;

  let logoSignedUrl: string | null = null;
  if (logoPath) {
    const { data: signed } = await supabase.storage
      .from(SCHOOL_LOGOS_BUCKET)
      .createSignedUrl(logoPath, 3600);
    logoSignedUrl = signed?.signedUrl ?? null;
  }

  return {
    schoolName,
    logoStoragePath: logoPath,
    logoSignedUrl,
    schoolAddress: row.school_address?.trim() ?? "",
    schoolPhone: row.school_phone?.trim() ?? "",
    schoolEmail: row.school_email?.trim() ?? "",
    website: row.website?.trim() ?? "",
    primaryColor: row.primary_color?.trim() || "#1e3a5f",
    secondaryColor: row.secondary_color?.trim() || "#4a6fa5",
    reportCardFooter: row.report_card_footer?.trim() ?? "",
    principalName: row.principal_name?.trim() ?? "",
    isConfigured: brandingIsConfigured(row),
  };
}
