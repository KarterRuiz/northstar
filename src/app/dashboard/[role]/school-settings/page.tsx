import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Settings } from "lucide-react";

import { canManageSchoolStructure, isRole, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import {
  assertSchoolSettingsDashboardRole,
  schoolSettingsReadOnlyForRole,
} from "@/features/school-settings/assert-school-settings-dashboard-role";
import { loadSchoolLogoPreviewUrl } from "@/features/school-settings/load-school-logo-preview-url";
import { loadSchoolSettings } from "@/features/school-settings/load-school-settings";
import { AcademicStructureForms } from "@/features/school-settings/academic-structure-forms";
import { loadAcademicStructurePageData } from "@/features/school-settings/load-academic-structure-data";
import { SchoolSettingsForm } from "@/features/school-settings/school-settings-form";

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
      <div className="ns-page-shell space-y-8 sm:space-y-10">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="School settings"
          description="Configure your school's identity for report cards and official records."
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

  let academicStructureBlock: ReactNode = null;
  if (canManageSchoolStructure(role)) {
    const ac = await loadAcademicStructurePageData();
    academicStructureBlock = !ac.ok ? (
      <section
        id="academic-structure"
        className="scroll-mt-24 space-y-3"
        aria-labelledby="academic-structure-heading"
      >
        <div className="space-y-1">
          <p className="ns-eyebrow">Configuration</p>
          <h2 id="academic-structure-heading" className="ns-section-title">
            Academic structure
          </h2>
        </div>
        <div
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          {ac.message}
        </div>
      </section>
    ) : (
      <AcademicStructureForms
        dashboardRole={role}
        schoolYears={ac.schoolYears}
        gradeLevels={ac.gradeLevels}
      />
    );
  }

  return (
    <div className="ns-page-shell space-y-10 sm:space-y-12">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="School settings"
        description={
          readOnly
            ? "View institution details used on report cards and official records."
            : "Configure academic structure, institution identity, branding, and official document text."
        }
        footer={
          <span className="inline-flex items-center gap-1.5">
            <Settings className="size-3.5 opacity-70" aria-hidden />
            {readOnly ? "Read-only for your role" : "Updates apply to new report cards"}
          </span>
        }
      />

      {academicStructureBlock}

      <SchoolSettingsForm
        dashboardRole={role}
        settings={loaded.settings}
        logoPreviewUrl={logoPreviewUrl}
        readOnly={readOnly}
      />
    </div>
  );
}
