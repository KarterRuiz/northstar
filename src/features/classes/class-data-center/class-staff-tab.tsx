import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { CLASS_TEACHER_ROLE_HOMEROOM } from "@/features/classes/constants";
import type { ClassManagementClassRow } from "@/features/classes/load-class-management-data";

import { ClassDataCenterStaffManageButton } from "./class-staff-manage-button";
import { loadClassDataCenterContext } from "./load-class-data-center-context";
import { loadClassDataCenterManagementOptions } from "./load-class-data-center-management-options";

export async function ClassDataCenterStaffTab({ classId }: { classId: string }) {
  const [ctx, management] = await Promise.all([
    loadClassDataCenterContext(classId),
    loadClassDataCenterManagementOptions(),
  ]);

  if (!ctx.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not load staff.</span> {ctx.message}
      </div>
    );
  }

  const { context } = ctx;
  const rows = [
    ...(context.homeroom ? [context.homeroom] : []),
    ...context.additionalTeachers,
  ];

  const klass: ClassManagementClassRow = {
    id: context.id,
    school_year_id: context.schoolYearId ?? "",
    grade_level_id: context.gradeLevelId,
    name: context.name,
    section: context.section,
    is_active: context.isActive,
    created_at: "",
    updated_at: "",
    schoolYearLabel: context.schoolYearLabel,
    gradeLevelName: context.gradeName,
    teachers: rows.map((t) => ({
      id: t.staffMemberId,
      staffMemberId: t.staffMemberId,
      teacherProfileId: t.profileId,
      role: t.roleInClassDb,
      teacherRole: t.roleInClass,
      teacherLabel: t.displayName,
    })),
    studentEnrollmentCount: context.studentCount,
    deletable: false,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <WorkspaceSectionHeader
          title="Staff"
          description="Homeroom and additional teachers assigned to this class."
        />
        {context.isActive ? (
          <ClassDataCenterStaffManageButton
            klass={klass}
            teachers={management.teachers}
          />
        ) : (
          <p className="text-muted-foreground text-sm" role="status">
            Restore this class before changing teachers.
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <ListEmptyState
          title="No teachers assigned"
          description="Use Manage teachers to assign a homeroom teacher and additional staff."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Role in class</TableHead>
                <TableHead>NorthStar account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.staffMemberId}>
                  <TableCell>
                    <Link
                      href={row.href}
                      className="text-primary font-medium underline-offset-4 hover:underline focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {row.displayName}
                    </Link>
                    {row.roleInClassDb === CLASS_TEACHER_ROLE_HOMEROOM ? (
                      <span className="text-muted-foreground ml-2 text-xs">Homeroom</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{row.roleInClass}</TableCell>
                  <TableCell className="text-sm">{row.accountStatus}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
