"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

import { roleLabels, type Role } from "@/config/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StaffInvitationRow } from "@/features/admin/staff-directory/staff-invitations-queries";
import {
  cancelStaffInvitationAction,
  linkStaffProfileFromInvitationAction,
  type StaffInvitationActionState,
} from "@/features/admin/staff-directory/staff-invitations-actions";

function statusBadgeVariant(
  status: StaffInvitationRow["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "pending":
      return "secondary";
    case "accepted":
      return "default";
    case "cancelled":
      return "outline";
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}

function InvitationRow({ row }: { row: StaffInvitationRow }) {
  const router = useRouter();
  const [cancelState, cancelAction, cancelPending] = useActionState<
    StaffInvitationActionState | undefined,
    FormData
  >(cancelStaffInvitationAction, undefined);

  const [linkState, linkAction, linkPending] = useActionState<
    StaffInvitationActionState | undefined,
    FormData
  >(linkStaffProfileFromInvitationAction, undefined);

  useEffect(() => {
    if (cancelState?.ok || linkState?.ok) {
      router.refresh();
    }
  }, [cancelState?.ok, linkState?.ok, router]);

  const isPending = row.status === "pending";
  const roleLabel = roleLabels[row.role as Role] ?? row.role;

  return (
    <TableRow>
      <TableCell className="font-medium">{row.full_name}</TableCell>
      <TableCell>
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          {row.email}
        </span>
      </TableCell>
      <TableCell className="text-sm">{roleLabel}</TableCell>
      <TableCell>
        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
        {new Date(row.created_at).toLocaleString()}
      </TableCell>
      <TableCell className="min-w-[14rem]">
        {isPending ? (
          <div className="flex flex-col gap-3">
            <form action={cancelAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="invitationId" value={row.id} />
              <Button type="submit" variant="outline" size="sm" disabled={cancelPending}>
                {cancelPending ? "Cancelling…" : "Cancel invite"}
              </Button>
              {cancelState && !cancelState.ok ? (
                <span className="text-destructive text-xs" role="alert">
                  {cancelState.message}
                </span>
              ) : null}
              {cancelState?.ok && cancelState.message ? (
                <span className="text-primary text-xs" role="status">
                  {cancelState.message}
                </span>
              ) : null}
            </form>
            <form action={linkAction} className="flex flex-col gap-2 border-t pt-3">
              <input type="hidden" name="invitationId" value={row.id} />
              <div className="space-y-1">
                <Label className="text-xs" htmlFor={`auth-user-${row.id}`}>
                  Link Auth user (UUID)
                </Label>
                <Input
                  id={`auth-user-${row.id}`}
                  name="authUserId"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  autoComplete="off"
                  disabled={linkPending}
                  className="font-mono text-xs"
                />
              </div>
              <Button type="submit" size="sm" disabled={linkPending}>
                {linkPending ? "Linking…" : "Link user & apply role"}
              </Button>
              {linkState && !linkState.ok ? (
                <p className="text-destructive text-xs" role="alert">
                  {linkState.message}
                </p>
              ) : null}
              {linkState?.ok && linkState.message ? (
                <p className="text-primary text-xs" role="status">
                  {linkState.message}
                </p>
              ) : null}
            </form>
          </div>
        ) : row.accepted_user_id ? (
          <code className="text-foreground/90 block truncate text-xs">{row.accepted_user_id}</code>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

type StaffInvitationsTableProps = {
  rows: StaffInvitationRow[];
  error: string | null;
};

export function StaffInvitationsTable({ rows, error }: StaffInvitationsTableProps) {
  return (
    <div className="space-y-3">
      {error ? (
        <div
          className="bg-muted/50 text-muted-foreground rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <span className="text-foreground font-medium">Could not load invitations.</span> {error}
        </div>
      ) : null}

      {rows.length === 0 && !error ? (
        <ListEmptyState
          icon={Mail}
          title="No invitations yet"
          description="Use “Invite staff member” to record someone before their Auth account exists."
        />
      ) : null}

      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">Name</TableHead>
              <TableHead className="w-[22%]">Email</TableHead>
              <TableHead className="w-[14%]">Role</TableHead>
              <TableHead className="w-[12%]">Status</TableHead>
              <TableHead className="w-[16%]">Created</TableHead>
              <TableHead className="w-[18%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <InvitationRow key={row.id} row={row} />
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
