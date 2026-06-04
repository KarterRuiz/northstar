"use client";

import { useActionState } from "react";
import { Users } from "lucide-react";

import { roleLabels, roles, type Role } from "@/config/roles";
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
import type { StaffProfileRow } from "@/features/admin/staff-directory/staff-directory-queries";
import {
  updateUserRoleAction,
  type UpdateUserRoleState,
} from "@/features/admin/staff-directory/staff-directory-actions";
import {
  formatStaffDirectoryEmail,
  formatStaffDirectoryName,
} from "@/lib/staff/format-staff-profile-label";

type StaffDirectoryTableProps = {
  rows: StaffProfileRow[];
  currentUserId: string;
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
            {roles.map((r: Role) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
          {isSelf ? (
            <p className="text-muted-foreground text-xs">
              If you are the only admin, you cannot remove your own admin role.
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

export function StaffDirectoryTable({
  rows,
  currentUserId,
}: StaffDirectoryTableProps) {
  if (rows.length === 0) {
    return (
      <ListEmptyState
        icon={Users}
        title="No staff profiles yet"
        description={
          <>
            Provision people in Supabase Auth and add matching{" "}
            <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
              profiles
            </code>{" "}
            rows so they appear here for role assignment.
          </>
        }
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[18%]">Name</TableHead>
          <TableHead className="w-[22%]">Email</TableHead>
          <TableHead className="w-[28%]">Role</TableHead>
          <TableHead className="w-[12%]">Status</TableHead>
          <TableHead className="w-[20%]">Profile id</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium text-sm">
              {formatStaffDirectoryName(row)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatStaffDirectoryEmail(row)}
            </TableCell>
            <RoleCell row={row} currentUserId={currentUserId} />
            <TableCell className="text-muted-foreground text-sm">
              {row.is_active ? "Active" : "Inactive"}
            </TableCell>
            <TableCell>
              <code className="text-foreground/90 block max-w-full truncate text-xs">
                {row.id}
              </code>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
