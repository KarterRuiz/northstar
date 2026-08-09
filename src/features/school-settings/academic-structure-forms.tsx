"use client";

import Link from "next/link";

import type { Role } from "@/config/roles";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import type { SchoolYearRow } from "@/features/classes/load-class-management-data";
import type { GradeLevelListItem } from "@/features/school-settings/load-academic-structure-data";

import { GradeLevelsPanel } from "./grade-levels-panel";
import { SchoolYearsPanel } from "./school-years-panel";

export function AcademicStructureForms({
  dashboardRole,
  schoolYears,
  gradeLevels,
}: {
  dashboardRole: Role;
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelListItem[];
}) {
  return (
    <section
      id="academic-structure"
      className="scroll-mt-24 space-y-6"
      aria-labelledby="academic-structure-heading"
    >
      <WorkspaceSectionHeader
        id="academic-structure-heading"
        eyebrow="Configuration"
        title="Academic structure"
        description={
          <>
            School years and grade levels are shared across the school. Manage them here; use{" "}
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
        <SchoolYearsPanel schoolYears={schoolYears} />
        <GradeLevelsPanel gradeLevels={gradeLevels} />
      </div>
    </section>
  );
}
