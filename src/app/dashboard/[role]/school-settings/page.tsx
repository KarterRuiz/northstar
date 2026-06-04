import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import {
  assertSchoolSettingsDashboardRole,
  schoolSettingsReadOnlyForRole,
} from "@/features/school-settings/assert-school-settings-dashboard-role";
import { loadSchoolLogoPreviewUrl } from "@/features/school-settings/load-school-logo-preview-url";
import { loadSchoolSettings } from "@/features/school-settings/load-school-settings";
import { SchoolSettingsForm } from "@/features/school-settings/school-settings-form";
import { Settings } from "lucide-react";

export const metadata: Metadata = {
  title: "School settings",
  description: "Institution identity for report cards and official records.",
};

type PageProps = {
  params: Promise<{ role: string }>;
};

export default async function SchoolSettingsPage({ params }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  await assertSchoolSettingsDashboardRole(role);

  const loaded = await loadSchoolSettings();
  const readOnly = schoolSettingsReadOnlyForRole(role);

  if (!loaded.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6 sm:p-8">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="School settings"
          description="Configure your school's name, logo, and report card branding."
        />
        <div
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          {loaded.message}
        </div>
      </div>
    );
  }

  const logoPreviewUrl = await loadSchoolLogoPreviewUrl(loaded.settings.logoStoragePath);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="School settings"
        description={
          readOnly
            ? "View institution details used on report cards and official records."
            : "Set your school's identity for report cards and records. This is separate from the Northstar platform name shown in the app shell."
        }
        footer={
          <span className="inline-flex items-center gap-1.5">
            <Settings className="size-3.5 opacity-70" aria-hidden />
            {readOnly ? "Read-only for your role" : "Changes apply to new report card previews"}
          </span>
        }
      />

      <SchoolSettingsForm
        dashboardRole={role}
        settings={loaded.settings}
        logoPreviewUrl={logoPreviewUrl}
        readOnly={readOnly}
      />
    </div>
  );
}
