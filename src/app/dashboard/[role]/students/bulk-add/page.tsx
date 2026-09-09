import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canManageStudents, isRole, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { BulkAddWizard } from "@/features/students/bulk-add/bulk-add-wizard";
import { loadBulkAddPageContext } from "@/features/students/bulk-add/load-bulk-add-context";
import { assertStudentDirectoryAccess } from "@/features/students/profile/access";

export const metadata: Metadata = {
  title: "Add multiple students",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams?: Promise<{ classId?: string }>;
};

export default async function BulkAddStudentsPage({
  params,
  searchParams,
}: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  assertStudentDirectoryAccess(role);
  if (!canManageStudents(role)) notFound();

  const query = searchParams ? await searchParams : {};
  const defaultClassId = query.classId?.trim() || null;

  const contextLoad = await loadBulkAddPageContext();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-widest uppercase">
            {siteConfig.shortName} · Students
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Add multiple students
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-snug">
            Enter several students with class Roster # order, then review before
            creating their records. Single-letter last names are allowed.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/${role}/students`}>Back to Students</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/${role}/students/import`}>Import roster</Link>
          </Button>
        </div>
      </div>

      {!contextLoad.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {contextLoad.message}
        </p>
      ) : (
        <BulkAddWizard
          dashboardRole={role}
          classOptions={contextLoad.classes}
          defaultClassId={defaultClassId}
        />
      )}
    </div>
  );
}
