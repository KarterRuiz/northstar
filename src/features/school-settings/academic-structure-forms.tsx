"use client";

import Link from "next/link";

import type { Role } from "@/config/roles";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { useWorkspaceToast, WorkspaceToast } from "@/components/workspace/workspace-toast";
import type { SchoolYearRow } from "@/features/classes/load-class-management-data";
import type {
  CurrentYearTermsSummary,
  GradeLevelListItem,
} from "@/features/school-settings/load-academic-structure-data";

import { CurrentYearTermsPanel } from "./current-year-terms-panel";
import { GradeLevelsPanel } from "./grade-levels-panel";
import { SchoolYearsPanel } from "./school-years-panel";

export function AcademicStructureForms({
  dashboardRole,
  schoolYears,
  gradeLevels,
  currentYearTerms,
}: {
  dashboardRole: Role;
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelListItem[];
  currentYearTerms: CurrentYearTermsSummary | null;
}) {
  const { toast, showToast } = useWorkspaceToast();

  return (
    <section
      id="academic-structure"
      className="scroll-mt-24 space-y-6"
      aria-labelledby="academic-structure-heading"
    >
      <WorkspaceToast toast={toast} />
      <WorkspaceSectionHeader
        id="academic-structure-heading"
        eyebrow="Configuration"
        title="Academic structure"
        description={
          <>
            School years, terms, and grade levels are shared across the school. Manage them
            here; use{" "}
            <Link
              href={`/dashboard/${dashboardRole}/classes`}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Classes
            </Link>{" "}
            to build sections and assign teachers.
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className="space-y-8">
          <SchoolYearsPanel schoolYears={schoolYears} />
          <CurrentYearTermsPanel summary={currentYearTerms} showToast={showToast} />
        </div>
        <GradeLevelsPanel gradeLevels={gradeLevels} />
      </div>
    </section>
  );
}
