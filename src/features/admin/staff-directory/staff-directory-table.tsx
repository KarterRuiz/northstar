"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

import { roleLabels, roles } from "@/config/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClassInviteOption } from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type {
  StaffClassAssignmentRow,
  StaffProfileRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import {
  toggleProfileActiveAction,
  updateUserRoleAction,
  type ToggleProfileActiveState,
  type UpdateUserRoleState,
} from "@/features/admin/staff-directory/staff-directory-actions";
import { StaffTeacherClassesDialog } from "@/features/admin/staff-directory/staff-teacher-classes-dialog";
import {
  formatStaffDirectoryEmail,
  formatStaffDirectoryName,
} from "@/lib/staff/format-staff-profile-label";

type StaffDirectoryTableProps = {
  rows: StaffProfileRow[];
  currentUserId: string;
  assignmentsByTeacher: Map<string, StaffClassAssignmentRow[]>;
  availableClasses: ClassInviteOption[];
};

function RoleCell({
  row,
  currentUserId,
}: {
  row: StaffProfileRow;
  currentUserId: string;
}) {
  const [state, formAction, pending] = useActionState<
    UpdateUserRoleState | undefined,
    FormData
  >(updateUserRoleAction, undefined);

  const isSelf = row.id === currentUserId;

  return (
    <TableCell className="max-w-[min(100vw,22rem)]">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="profileId" value={row.id} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label className="sr-only" htmlFor={`role-${row.id}`}>
            Role for profile {row.id}
          </label>
          <select
            id={`role-${row.id}`}
            name="newRole"
            defaultValue={row.role}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full min-w-0 rounded-md border px-2 text-sm shadow-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
          {isSelf ? (
            <p className="text-muted-foreground text-xs">
              If you are the only admin, you cannot remove the last admin role from the directory.
            </p>
          ) : null}
        </div>
        <Button type="submit" size="sm" disabled={pending} className="shrink-0">
          {pending ? "Saving…" : "Save role"}
        </Button>
        {state && !state.ok ? (
          <p className="text-destructive w-full text-xs sm:order-last sm:basis-full" role="alert">
            {state.message}
          </p>
        ) : null}
        {state?.ok && state.message ? (
          <p className="text-primary w-full text-xs sm:order-last sm:basis-full" role="status">
            {state.message}
          </p>
        ) : null}
      </form>
    </TableCell>
  );
}

function AccessCell({ row, currentUserId }: { row: StaffProfileRow; currentUserId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ToggleProfileActiveState | undefined,
    FormData
  >(toggleProfileActiveAction, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  const isSelf = row.id === currentUserId;

  return (
    <TableCell>
      <div className="flex flex-col gap-2">
        <Badge variant={row.is_active ? "default" : "secondary"}>
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
        <form action={formAction} className="flex flex-col gap-1">
          <input type="hidden" name="profileId" value={row.id} />
          <input type="hidden" name="nextActive" value={row.is_active ? "false" : "true"} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={pending || (isSelf && row.is_active)}
            className="w-fit"
          >
            {pending ? "Updating…" : row.is_active ? "Deactivate" : "Reactivate"}
          </Button>
          {isSelf && row.is_active ? (
            <p className="text-muted-foreground max-w-[12rem] text-xs">Cannot deactivate yourself.</p>
          ) : null}
        </form>
        {state && !state.ok ? (
          <p className="text-destructive text-xs" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </TableCell>
  );
}

export function StaffDirectoryTable({
  rows,
  currentUserId,
  assignmentsByTeacher,
  availableClasses,
}: StaffDirectoryTableProps) {
  if (rows.length === 0) {
    return (
      <ListEmptyState
        icon={Users}
        title="No staff match your filters"
        description="Try clearing search or filters, or invite a colleague to get started."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[18%]">Name</TableHead>
          <TableHead className="w-[20%]">Email</TableHead>
          <TableHead className="w-[26%]">Role</TableHead>
          <TableHead className="w-[14%]">Access</TableHead>
          <TableHead className="w-[12%]">Classes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const assigned = assignmentsByTeacher.get(row.id) ?? [];
          const teacherLabel = formatStaffDirectoryName(row);
          return (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-sm">
                {formatStaffDirectoryName(row)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatStaffDirectoryEmail(row)}
              </TableCell>
              <RoleCell row={row} currentUserId={currentUserId} />
              <AccessCell row={row} currentUserId={currentUserId} />
              <TableCell>
                {row.role === "teacher" ? (
                  <StaffTeacherClassesDialog
                    teacherProfileId={row.id}
                    teacherLabel={teacherLabel}
                    assigned={assigned}
                    availableClasses={availableClasses}
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
