import type { SchoolSettingsRow } from "@/lib/school-settings/types";

type SchoolSettingsDbRow = {
  id: string;
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
  created_at: string;
  updated_at: string;
};

export function mapSchoolSettingsRow(row: SchoolSettingsDbRow): SchoolSettingsRow {
  return {
    id: row.id,
    schoolName: row.school_name ?? "",
    logoStoragePath: row.logo_storage_path,
    schoolAddress: row.school_address ?? "",
    schoolPhone: row.school_phone ?? "",
    schoolEmail: row.school_email ?? "",
    website: row.website ?? "",
    primaryColor: row.primary_color ?? "",
    secondaryColor: row.secondary_color ?? "",
    reportCardFooter: row.report_card_footer ?? "",
    principalName: row.principal_name ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
