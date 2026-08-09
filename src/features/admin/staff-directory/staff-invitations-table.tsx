"use client";

import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Mail, MoreHorizontal } from "lucide-react";

import { roleLabels, roles, type Role } from "@/config/roles";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { CopyTextButton } from "@/components/ui/copy-text-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DirectoryPeopleCell } from "@/components/workspace/directory-people-cell";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminTeacherInviteAssignedClasses } from "@/features/admin/staff-directory/admin-assigned-classes-field";
import { AdminStaffGradeLevelsField } from "@/features/admin/staff-directory/admin-assigned-grade-levels-field";
import type {
  ClassInviteOption,
  GradeInviteOption,
} from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type { StaffInvitationRow } from "@/features/admin/staff-directory/staff-invitations-queries";
import {
  cancelStaffInvitationAction,
  linkStaffProfileFromInvitationAction,
  renewStaffInvitationAction,
  resendStaffInvitationAction,
  updatePendingStaffInvitationAction,
  type StaffInvitationActionState,
} from "@/features/admin/staff-directory/staff-invitations-actions";
import {
  isActionableStaffInvitation,
  staffInvitationDisplayStatus,
  staffInvitationStatusLabel,
} from "@/lib/staff/invitation-display-status";
import { buildStaffInviteLink } from "@/lib/staff/staff-invite-link";

function invitationStatusKind(
  status: ReturnType<typeof staffInvitationDisplayStatus>,
): StatusKind {
  switch (status) {
    case "pending":
      return "pending";
    case "accepted":
      return "active";
    case "cancelled":
      return "archived";
    case "expired":
      return "expired";
    case "inactive":
      return "inactive";
    default:
      return "inactive";
  }
}

function formatInvitedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ActionMessage({ state }: { state: StaffInvitationActionState | undefined }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <span className="text-destructive text-xs" role="alert">
        {state.message}
      </span>
    );
  }
  if (!state.message) return null;
  return (
    <span className="text-primary text-xs" role="status">
      {state.message}
    </span>
  );
}

function AdvancedRecovery({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [linkState, linkAction, linkPending] = useActionState<
    StaffInvitationActionState | undefined,
    FormData
  >(linkStaffProfileFromInvitationAction, undefined);

  useEffect(() => {
    if (linkState?.ok) router.refresh();
  }, [linkState?.ok, router]);

  return (
    <details className="border-border/60 rounded-md border px-2 py-1.5">
      <summary className="text-muted-foreground cursor-pointer list-none text-xs font-medium select-none [&::-webkit-details-marker]:hidden">
        Advanced recovery
      </summary>
      <form action={linkAction} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="invitationId" value={invitationId} />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Rare cases only: link an existing signed-up account by its user id.
        </p>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`auth-user-${invitationId}`}>
            Account user id
          </Label>
          <Input
            id={`auth-user-${invitationId}`}
            name="authUserId"
            placeholder="Paste account user id"
            autoComplete="off"
            disabled={linkPending}
            className="font-mono text-xs"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={linkPending}>
          {linkPending ? "Linking…" : "Link account"}
        </Button>
        <ActionMessage state={linkState} />
      </form>
    </details>
  );
}

function EditPendingInvitationForm({
  row,
  gradeOptions,
  classOptions,
  onClose,
}: {
  row: StaffInvitationRow;
  gradeOptions: GradeInviteOption[];
  classOptions: ClassInviteOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const initialFirst = row.first_name?.trim();
  const initialLast = row.last_name?.trim();
  const splitFromFull = row.full_name.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(
    initialFirst || splitFromFull[0] || "",
  );
  const [lastName, setLastName] = useState(
    initialLast || (initialFirst ? "" : splitFromFull.slice(1).join(" ")),
  );
  const [email, setEmail] = useState(row.email);
  const [role, setRole] = useState(row.role);
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>(
    () => row.pending_grade_level_ids ?? [],
  );

  const [state, formAction, pending] = useActionState<
    StaffInvitationActionState | undefined,
    FormData
  >(updatePendingStaffInvitationAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onClose();
    }
  }, [state?.ok, router, onClose]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit invitation</DialogTitle>
        <DialogDescription>
          Update name, email, role, or access before they accept. Changing email does not create a
          second pending invite — use Resend afterward.
        </DialogDescription>
      </DialogHeader>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="invitationId" value={row.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`inv-first-${row.id}`}>First name</Label>
            <Input
              id={`inv-first-${row.id}`}
              name="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`inv-last-${row.id}`}>Last name</Label>
            <Input
              id={`inv-last-${row.id}`}
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              disabled={pending}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`inv-email-${row.id}`}>Email</Label>
          <Input
            id={`inv-email-${row.id}`}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`inv-role-${row.id}`}>Role</Label>
          <select
            id={`inv-role-${row.id}`}
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            disabled={pending}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
        </div>
        {role === "teacher" ? (
          <>
            <AdminStaffGradeLevelsField
              options={gradeOptions}
              disabled={pending}
              initialSelectedIds={row.pending_grade_level_ids ?? []}
              onSelectedIdsChange={setSelectedGradeIds}
            />
            <AdminTeacherInviteAssignedClasses
              options={classOptions}
              disabled={pending}
              allowedGradeLevelIds={selectedGradeIds}
              initialSelectedIds={row.pending_class_ids ?? []}
            />
          </>
        ) : null}
        <ActionMessage state={state} />
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save invitation"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function EditPendingInvitationDialog({
  row,
  gradeOptions,
  classOptions,
  open,
  onOpenChange,
}: {
  row: StaffInvitationRow;
  gradeOptions: GradeInviteOption[];
  classOptions: ClassInviteOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {open ? (
          <EditPendingInvitationForm
            key={`${row.id}-${row.updated_at}`}
            row={row}
            gradeOptions={gradeOptions}
            classOptions={classOptions}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InvitationActions({
  row,
  loginBaseUrl,
  mode,
  gradeOptions,
  classOptions,
}: {
  row: StaffInvitationRow;
  loginBaseUrl: string;
  mode: "actionable" | "history";
  gradeOptions: GradeInviteOption[];
  classOptions: ClassInviteOption[];
}) {
  const router = useRouter();
  const displayStatus = staffInvitationDisplayStatus(row);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const [cancelState, cancelAction, cancelPending] = useActionState<
    StaffInvitationActionState | undefined,
    FormData
  >(cancelStaffInvitationAction, undefined);
  const [resendState, resendAction, resendPending] = useActionState<
    StaffInvitationActionState | undefined,
    FormData
  >(resendStaffInvitationAction, undefined);
  const [renewState, renewAction, renewPending] = useActionState<
    StaffInvitationActionState | undefined,
    FormData
  >(renewStaffInvitationAction, undefined);

  useEffect(() => {
    if (cancelState?.ok || resendState?.ok || renewState?.ok) {
      router.refresh();
    }
  }, [cancelState?.ok, resendState?.ok, renewState?.ok, router]);

  const inviteUrl = useMemo(
    () => buildStaffInviteLink(loginBaseUrl, row.invite_token),
    [loginBaseUrl, row.invite_token],
  );

  if (mode === "history") {
    return <span className="ns-meta">—</span>;
  }

  if (displayStatus === "pending") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          {inviteUrl ? (
            <CopyTextButton text={inviteUrl} label="Copy link" size="sm" />
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                aria-label={`Invitation actions for ${row.full_name}`}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                disabled={resendPending}
                onSelect={() => {
                  const fd = new FormData();
                  fd.set("invitationId", row.id);
                  resendAction(fd);
                }}
              >
                {resendPending ? "Sending…" : "Resend"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={cancelPending}
                onSelect={() => setConfirmWithdraw(true)}
              >
                Withdraw
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ActionMessage state={resendState} />
        <ActionMessage state={cancelState} />
        <AdvancedRecovery invitationId={row.id} />
        <EditPendingInvitationDialog
          row={row}
          gradeOptions={gradeOptions}
          classOptions={classOptions}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
        <Dialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw invitation?</DialogTitle>
              <DialogDescription>
                {row.full_name} will no longer be able to accept this invite.
              </DialogDescription>
            </DialogHeader>
            <form action={cancelAction} onSubmit={() => setConfirmWithdraw(false)}>
              <input type="hidden" name="invitationId" value={row.id} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmWithdraw(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={cancelPending}>
                  {cancelPending ? "Withdrawing…" : "Withdraw"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (displayStatus === "expired") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <form action={renewAction}>
            <input type="hidden" name="invitationId" value={row.id} />
            <Button type="submit" size="sm" disabled={renewPending}>
              {renewPending ? "Renewing…" : "Renew"}
            </Button>
          </form>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                aria-label={`More actions for ${row.full_name}`}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={cancelPending}
                onSelect={() => setConfirmWithdraw(true)}
              >
                Withdraw
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ActionMessage state={renewState} />
        <ActionMessage state={cancelState} />
        <EditPendingInvitationDialog
          row={row}
          gradeOptions={gradeOptions}
          classOptions={classOptions}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
        <Dialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw invitation?</DialogTitle>
              <DialogDescription>
                Remove this expired invite for {row.full_name}.
              </DialogDescription>
            </DialogHeader>
            <form action={cancelAction} onSubmit={() => setConfirmWithdraw(false)}>
              <input type="hidden" name="invitationId" value={row.id} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmWithdraw(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={cancelPending}>
                  {cancelPending ? "Withdrawing…" : "Withdraw"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return <span className="ns-meta">—</span>;
}

function InvitationDataRow({
  row,
  loginBaseUrl,
  mode,
  earlierCount,
  gradeOptions,
  classOptions,
}: {
  row: StaffInvitationRow;
  loginBaseUrl: string;
  mode: "actionable" | "history";
  earlierCount?: number;
  gradeOptions: GradeInviteOption[];
  classOptions: ClassInviteOption[];
}) {
  const displayStatus = staffInvitationDisplayStatus(row);
  const roleLabel = roleLabels[row.role as Role] ?? row.role;

  return (
    <TableRow>
      <TableCell>
        <DirectoryPeopleCell
          name={row.full_name}
          meta={
            earlierCount && earlierCount > 0
              ? `+${earlierCount} earlier invite${earlierCount === 1 ? "" : "s"}`
              : undefined
          }
        />
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Mail className="size-3.5 shrink-0 opacity-70" aria-hidden />
          {row.email}
        </span>
      </TableCell>
      <TableCell className="text-sm">{roleLabel}</TableCell>
      <TableCell className="ns-meta whitespace-nowrap">
        {formatInvitedDate(row.created_at)}
      </TableCell>
      <TableCell>
        <StatusBadge
          status={invitationStatusKind(displayStatus)}
          label={staffInvitationStatusLabel(displayStatus)}
        />
      </TableCell>
      <TableCell className="min-w-[8rem]">
        <InvitationActions
          row={row}
          loginBaseUrl={loginBaseUrl}
          mode={mode}
          gradeOptions={gradeOptions}
          classOptions={classOptions}
        />
      </TableCell>
    </TableRow>
  );
}

function InvitationsTableFrame({ children }: { children: ReactNode }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[18%]">Name</TableHead>
          <TableHead className="w-[22%]">Email</TableHead>
          <TableHead className="w-[14%]">Role</TableHead>
          <TableHead className="w-[14%]">Invited</TableHead>
          <TableHead className="w-[12%]">Status</TableHead>
          <TableHead className="w-[20%]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}

/** Collapse repeated historical invites for the same email to the latest row. */
function dedupeHistoryByEmail(rows: StaffInvitationRow[]): {
  row: StaffInvitationRow;
  earlierCount: number;
}[] {
  const byEmail = new Map<string, StaffInvitationRow[]>();
  for (const row of rows) {
    const key = row.email.trim().toLowerCase();
    const list = byEmail.get(key) ?? [];
    list.push(row);
    byEmail.set(key, list);
  }

  const groups: { row: StaffInvitationRow; earlierCount: number }[] = [];
  for (const list of byEmail.values()) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    groups.push({ row: sorted[0]!, earlierCount: Math.max(0, sorted.length - 1) });
  }

  groups.sort(
    (a, b) =>
      new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime(),
  );
  return groups;
}

type StaffInvitationsTableProps = {
  rows: StaffInvitationRow[];
  error: string | null;
  loginBaseUrl: string;
  gradeOptions: GradeInviteOption[];
  classOptions: ClassInviteOption[];
};

export function StaffInvitationsTable({
  rows,
  error,
  loginBaseUrl,
  gradeOptions,
  classOptions,
}: StaffInvitationsTableProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  const actionable = useMemo(
    () =>
      rows
        .filter((r) => isActionableStaffInvitation(r))
        .sort((a, b) => {
          const aExpired = staffInvitationDisplayStatus(a) === "expired" ? 1 : 0;
          const bExpired = staffInvitationDisplayStatus(b) === "expired" ? 1 : 0;
          if (aExpired !== bExpired) return aExpired - bExpired;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
    [rows],
  );

  const history = useMemo(
    () => rows.filter((r) => !isActionableStaffInvitation(r)),
    [rows],
  );
  const historyGroups = useMemo(() => dedupeHistoryByEmail(history), [history]);
  const hiddenHistoryCount = history.length - historyGroups.length;

  return (
    <div className="space-y-4">
      {error ? (
        <div
          className="bg-muted/50 text-muted-foreground rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <span className="text-foreground font-medium">Could not load invitations.</span>{" "}
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="ns-card-title">Pending invitations</h3>
        {actionable.length === 0 && !error ? (
          <ListEmptyState
            icon={Mail}
            title="No pending invitations"
            description="Invite a colleague to send access. Accepted staff appear in the directory above."
          />
        ) : null}
        {actionable.length > 0 ? (
          <InvitationsTableFrame>
            {actionable.map((row) => (
              <InvitationDataRow
                key={row.id}
                row={row}
                loginBaseUrl={loginBaseUrl}
                mode="actionable"
                gradeOptions={gradeOptions}
                classOptions={classOptions}
              />
            ))}
          </InvitationsTableFrame>
        ) : null}
      </div>

      {history.length > 0 ? (
        <details
          className="group border-border/60 rounded-lg border"
          open={historyOpen}
          onToggle={(e) => setHistoryOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="text-foreground flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden
            />
            View invitation history
            <span className="text-muted-foreground font-normal">
              (
              {hiddenHistoryCount > 0
                ? `${historyGroups.length} shown of ${history.length}`
                : history.length}
              )
            </span>
          </summary>
          <div className="border-t px-1 pb-2 sm:px-2">
            <p className="text-muted-foreground px-2 py-2 text-xs">
              Accepted and withdrawn invites are kept for your records. Earlier invites for the
              same email are grouped so the list stays readable.
            </p>
            <InvitationsTableFrame>
              {historyGroups.map(({ row, earlierCount }) => (
                <InvitationDataRow
                  key={row.id}
                  row={row}
                  loginBaseUrl={loginBaseUrl}
                  mode="history"
                  earlierCount={earlierCount}
                  gradeOptions={gradeOptions}
                  classOptions={classOptions}
                />
              ))}
            </InvitationsTableFrame>
          </div>
        </details>
      ) : null}
    </div>
  );
}
