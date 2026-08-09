import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canManageStudents, isRole, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { assertStudentDirectoryAccess } from "@/features/students/profile/access";
import { loadRosterImportContext } from "@/features/students/roster-import/load-roster-context";
import { RosterImportWizard } from "@/features/students/roster-import/roster-import-wizard";

export const metadata: Metadata = {
  title: "Import student roster",
};

type PageProps = {
  params: Promise<{ role: string }>;
};

export default async function ImportStudentRosterPage({ params }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  assertStudentDirectoryAccess(role);
  if (!canManageStudents(role)) notFound();

  const contextLoad = await loadRosterImportContext();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-widest uppercase">
            {siteConfig.shortName} · Students
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Import student roster
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-snug">
            Upload a CSV or Excel roster, map columns, validate, then create or update
            students in bulk. Single-student add is still available from the directory.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/${role}/students/new`}>Add single student</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/${role}/students`}>Directory</Link>
          </Button>
        </div>
      </div>

      {!contextLoad.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {contextLoad.message}
        </p>
      ) : (
        <RosterImportWizard
          dashboardRole={role}
          schoolYearLabel={contextLoad.context.schoolYearLabel}
        />
      )}
    </div>
  );
}
