"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Users } from "lucide-react";

import { isRole, roleLabels, type Role } from "@/config/roles";
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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DirectoryClickableRow,
  DirectoryRowHitTarget,
} from "@/components/workspace/directory-clickable-row";
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
import { WorkspaceToast, useWorkspaceToast } from "@/components/workspace/workspace-toast";
import { AdminTeacherInviteAssignedClasses } from "@/features/admin/staff-directory/admin-assigned-classes-field";
import { AdminStaffGradeLevelsField } from "@/features/admin/staff-directory/admin-assigned-grade-levels-field";
import { formatStaffAssignedClassesSummary } from "@/features/admin/staff-directory/format-assigned-classes-summary";
import { formatStaffAssignedGradesSummary } from "@/features/admin/staff-directory/format-assigned-grades-summary";
import type {
  ClassInviteOption,
  GradeInviteOption,
} from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import { staffProfilePath } from "@/features/admin/staff-directory/staff-directory-path";
import type {
  StaffClassAssignmentRow,
  StaffGradeAccessRow,
  StaffMemberRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import {
  archiveStaffMemberAction,
  deactivateStaffMemberAction,
  deleteStaffMemberAction,
  reactivateStaffMemberAction,
  updateStaffMemberAction,
  type StaffMemberActionState,
} from "@/features/admin/staff-directory/staff-members-actions";
import {
  resendStaffMemberInvitationAction,
  sendStaffMemberSetupLinkAction,
  type SendStaffInvitationsState,
} from "@/features/admin/staff-directory/send-staff-invitations-actions";
import {
  StaffMemberClassesDialog,
  StaffMemberGradesDialog,
} from "@/features/admin/staff-directory/staff-member-access-dialogs";
import { STAFF_DELETE_CONFIRM_HINT } from "@/features/admin/staff-directory/constants";
import { buildStaffInviteLink } from "@/lib/staff/staff-invite-link";
import {
  canResendStaffMemberInvitation,
  canSendActiveStaffPasswordReset,
  canSendStaffNewInvitation,
  canSendStaffSetupLink,
  formatInviteSentHint,
} from "@/lib/staff/staff-invite-email";
import {
  canSendStaffInvitation,
  staffRosterStatusKind,
  staffRosterStatusLabel,
} from "@/lib/staff/staff-roster-status";

const EDIT_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "teacher", label: "Teacher" },
  { value: "registrar", label: "Registrar" },
  { value: "vice_principal", label: "Vice principal" },
  { value: "principal", label: "School leadership (principal)" },
  { value: "admin", label: "Admin" },
];

type StaffDirectoryTableProps = {
  rows: StaffMemberRow[];
  role: Role;
  currentUserId: string;
  assignmentsByMember: Map<string, StaffClassAssignmentRow[]>;
  gradesByMember: Map<string, StaffGradeAccessRow[]>;
  availableGrades: GradeInviteOption[];
  availableClasses: ClassInviteOption[];
  deletableByStaffMemberId: Record<string, boolean>;
  loginBaseUrl: string;
};

type ConfirmKind = "deactivate" | "reactivate" | "archive" | "delete" | null;

function StaffInviteStatusCell({
  row,
  onToast,
}: {
  row: StaffMemberRow;
  onToast: (kind: "success" | "error", message: string) => void;
}) {
  const router = useRouter();
  const [resendState, resendAction, resendPending] = useActionState<
    SendStaffInvitationsState | undefined,
    FormData
  >(resendStaffMemberInvitationAction, undefined);
  const [setupState, setupAction, setupPending] = useActionState<
    SendStaffInvitationsState | undefined,
    FormData
  >(sendStaffMemberSetupLinkAction, undefined);

  const canSendNew = canSendStaffNewInvitation({
    profileId: row.profile_id,
    archivedAt: row.archived_at,
    membershipStatus: row.status,
    displayStatus: row.displayStatus,
    email: row.email,
    authEmailConfirmed: row.authEmailConfirmed,
  });
  const canResend = canResendStaffMemberInvitation({
    profileId: row.profile_id,
    archivedAt: row.archived_at,
    membershipStatus: row.status,
    displayStatus: row.displayStatus,
    email: row.email,
    authEmailConfirmed: row.authEmailConfirmed,
  });
  const canSetup = canSendStaffSetupLink({
    profileId: row.profile_id,
    archivedAt: row.archived_at,
    membershipStatus: row.status,
    displayStatus: row.displayStatus,
    email: row.email,
    authEmailConfirmed: row.authEmailConfirmed,
  });
  const canActiveReset = canSendActiveStaffPasswordReset({
    profileId: row.profile_id,
    archivedAt: row.archived_at,
    membershipStatus: row.status,
    displayStatus: row.displayStatus,
    email: row.email,
  });
  const sentHint = canResend ? formatInviteSentHint(row.inviteSentAt) : null;
  const actionPending = resendPending || setupPending;
  const actionState = setupState ?? resendState;

  const handledAction = useRef<string | null>(null);
  useEffect(() => {
    if (!actionState) return;
    const key = `${actionState.ok}:${actionState.message}`;
    if (handledAction.current === key) return;
    handledAction.current = key;
    onToast(actionState.ok ? "success" : "error", actionState.message);
    if (actionState.ok) router.refresh();
  }, [actionState, onToast, router]);

  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge
        status={staffRosterStatusKind(row.displayStatus)}
        label={staffRosterStatusLabel(row.displayStatus)}
      />
      {canSetup ? (
        <form action={setupAction} className="relative z-10">
          <input type="hidden" name="staffMemberId" value={row.id} />
          <Button
            type="submit"
            variant="link"
            size="sm"
            className="text-primary h-auto px-0 py-0 text-xs font-medium"
            disabled={actionPending}
          >
            {setupPending ? "Sending…" : "Send setup link"}
          </Button>
        </form>
      ) : null}
      {canActiveReset ? (
        <form action={setupAction} className="relative z-10">
          <input type="hidden" name="staffMemberId" value={row.id} />
          <Button
            type="submit"
            variant="link"
            size="sm"
            className="text-primary h-auto px-0 py-0 text-xs font-medium"
            disabled={actionPending}
          >
            {setupPending ? "Sending…" : "Send password reset"}
          </Button>
        </form>
      ) : null}
      {canSendNew ? (
        <form action={resendAction} className="relative z-10">
          <input type="hidden" name="staffMemberId" value={row.id} />
          <Button
            type="submit"
            variant="link"
            size="sm"
            className="text-primary h-auto px-0 py-0 text-xs font-medium"
            disabled={actionPending}
          >
            {resendPending ? "Sending…" : "Send invitation"}
          </Button>
        </form>
      ) : null}
      {canResend ? (
        <form action={resendAction} className="relative z-10">
          <input type="hidden" name="staffMemberId" value={row.id} />
          <Button
            type="submit"
            variant="link"
            size="sm"
            className="text-primary h-auto px-0 py-0 text-xs font-medium"
            disabled={actionPending}
          >
            {resendPending ? "Resending…" : "Resend invitation"}
          </Button>
        </form>
      ) : null}
      {sentHint ? (
        <span className="text-muted-foreground text-xs" role="status">
          {sentHint}
        </span>
      ) : null}
      {resendState?.ok && resendState.results[0]?.inviteUrl ? (
        <CopyTextButton
          text={resendState.results[0].inviteUrl}
          label="Copy new link"
          size="sm"
        />
      ) : null}
    </div>
  );
}

function formatLastActivity(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EditStaffForm({
  row,
  onClose,
  onSuccess,
  focusEmail = false,
  assignedGrades,
  assignedClasses,
  availableGrades,
  availableClasses,
}: {
  row: StaffMemberRow;
  onClose: () => void;
  onSuccess: (message: string) => void;
  focusEmail?: boolean;
  assignedGrades: StaffGradeAccessRow[];
  assignedClasses: StaffClassAssignmentRow[];
  availableGrades: GradeInviteOption[];
  availableClasses: ClassInviteOption[];
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const handledSuccess = useRef(false);
  const [firstName, setFirstName] = useState(row.first_name);
  const [lastName, setLastName] = useState(row.last_name);
  const [email, setEmail] = useState(row.email ?? "");
  const [selectedRole, setSelectedRole] = useState<Role>(
    isRole(row.role) ? row.role : "teacher",
  );
  const [notes, setNotes] = useState(row.notes ?? "");
  const [confirmLoginEmailChange, setConfirmLoginEmailChange] = useState(false);
  const [selectedGradeIds, setSelectedGradeIds] = useState(() =>
    assignedGrades.map((g) => g.gradeLevelId),
  );

  const [state, formAction, pending] = useActionState<
    StaffMemberActionState | undefined,
    FormData
  >(updateStaffMemberAction, undefined);

  const originalEmail = (row.email ?? "").trim().toLowerCase();
  const emailChanged =
    email.trim().toLowerCase() !== originalEmail && Boolean(row.profile_id);
  const initialGradeIds = assignedGrades.map((g) => g.gradeLevelId);
  const initialClassIds = assignedClasses.map((c) => c.classId);

  useEffect(() => {
    if (focusEmail) {
      emailRef.current?.focus();
    }
  }, [focusEmail]);

  useEffect(() => {
    if (state?.ok && !handledSuccess.current) {
      handledSuccess.current = true;
      onSuccess(state.message ?? `${row.full_name} updated.`);
      onClose();
    }
  }, [state, onSuccess, onClose, row.full_name]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{focusEmail && !row.email ? "Add email" : "Edit staff"}</DialogTitle>
        <DialogDescription>
          {focusEmail && !row.email
            ? `Add an email address for ${row.full_name} before sending an invitation. No invite is sent until you choose Send invitation.`
            : `Update roster details for ${row.full_name}. Saving does not send an invitation.`}
        </DialogDescription>
      </DialogHeader>
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="staffMemberId" value={row.id} />
        {confirmLoginEmailChange ? (
          <input type="hidden" name="confirmLoginEmailChange" value="true" />
        ) : null}

        <fieldset className="space-y-4">
          <legend className="text-foreground text-sm font-medium">Identity</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-first-${row.id}`}>First name</Label>
              <Input
                id={`edit-first-${row.id}`}
                name="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-last-${row.id}`}>Last name</Label>
              <Input
                id={`edit-last-${row.id}`}
                name="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={pending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-email-${row.id}`}>
              Email address{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              ref={emailRef}
              id={`edit-email-${row.id}`}
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              placeholder="teacher@example.com"
            />
            {row.profile_id ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Linked to a sign-in account. Changing email requires confirming a login email
                update below — it is never applied silently.
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Optional for roster planning. Required later when you send an invitation — no
                invite is sent on save.
              </p>
            )}
          </div>
          {emailChanged ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="border-input mt-1"
                checked={confirmLoginEmailChange}
                onChange={(e) => setConfirmLoginEmailChange(e.target.checked)}
                disabled={pending}
              />
              <span>
                Also update sign-in email (changes how they log in). Leave unchecked to keep the
                current login email.
              </span>
            </label>
          ) : null}
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor={`edit-role-${row.id}`}>Dashboard role</Label>
          <select
            id={`edit-role-${row.id}`}
            name="role"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as Role)}
            disabled={pending}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {EDIT_ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {selectedRole === "teacher" ? (
          <>
            <AdminStaffGradeLevelsField
              key={`edit-grades-${row.id}-${[...initialGradeIds].sort().join(",")}`}
              options={availableGrades}
              disabled={pending}
              initialSelectedIds={initialGradeIds}
              onSelectedIdsChange={setSelectedGradeIds}
            />
            <AdminTeacherInviteAssignedClasses
              key={`edit-classes-${row.id}-${[...initialClassIds].sort().join(",")}`}
              options={availableClasses}
              disabled={pending}
              initialSelectedIds={initialClassIds}
              allowedGradeLevelIds={selectedGradeIds}
            />
          </>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`edit-notes-${row.id}`}>Notes (optional)</Label>
          <Input
            id={`edit-notes-${row.id}`}
            name="staffNote"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
            maxLength={500}
            placeholder="Starts Monday — laptop ready in room 204"
          />
        </div>
        {state && !state.ok ? (
          <p className="text-destructive text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function StaffRowActions({
  row,
  currentUserId,
  assigned,
  grades,
  availableGrades,
  availableClasses,
  canDeletePermanently,
  loginBaseUrl,
  onToast,
}: {
  row: StaffMemberRow;
  currentUserId: string;
  assigned: StaffClassAssignmentRow[];
  grades: StaffGradeAccessRow[];
  availableGrades: GradeInviteOption[];
  availableClasses: ClassInviteOption[];
  canDeletePermanently: boolean;
  loginBaseUrl: string;
  onToast: (kind: "success" | "error", message: string) => void;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [gradesOpen, setGradesOpen] = useState(false);
  const [classesOpen, setClassesOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [linkCopiedFlash, setLinkCopiedFlash] = useState(false);

  const [deactivateState, deactivateAction, deactivatePending] = useActionState<
    StaffMemberActionState | undefined,
    FormData
  >(deactivateStaffMemberAction, undefined);
  const [reactivateState, reactivateAction, reactivatePending] = useActionState<
    StaffMemberActionState | undefined,
    FormData
  >(reactivateStaffMemberAction, undefined);
  const [archiveState, archiveAction, archivePending] = useActionState<
    StaffMemberActionState | undefined,
    FormData
  >(archiveStaffMemberAction, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState<
    StaffMemberActionState | undefined,
    FormData
  >(deleteStaffMemberAction, undefined);
  const [resendState, resendAction, resendPending] = useActionState<
    SendStaffInvitationsState | undefined,
    FormData
  >(resendStaffMemberInvitationAction, undefined);
  const [setupState, setupAction, setupPending] = useActionState<
    SendStaffInvitationsState | undefined,
    FormData
  >(sendStaffMemberSetupLinkAction, undefined);

  const pending =
    deactivatePending ||
    reactivatePending ||
    archivePending ||
    deletePending ||
    resendPending ||
    setupPending;
  const isSelf = row.profile_id === currentUserId;
  const isArchived = row.displayStatus === "archived";
  const isDisabled = row.displayStatus === "disabled";
  const gradeIds = grades.map((g) => g.gradeLevelId);
  const hasEmail = Boolean(row.email?.trim());
  const inviteUrl = useMemo(
    () =>
      row.inviteToken ? buildStaffInviteLink(loginBaseUrl, row.inviteToken) : "",
    [loginBaseUrl, row.inviteToken],
  );

  const latestInviteForEligibility =
    row.displayStatus === "invitation_sent" || row.displayStatus === "opened"
      ? { status: "pending" as const, expires_at: null as string | null }
      : row.inviteStatus
        ? { status: row.inviteStatus, expires_at: null as string | null }
        : null;

  const canSendNew = canSendStaffInvitation({
    membershipStatus: row.status,
    archivedAt: row.archived_at,
    profileId: row.profile_id,
    email: row.email,
    latestInvite: latestInviteForEligibility,
  });
  const canResend = canResendStaffMemberInvitation({
    profileId: row.profile_id,
    archivedAt: row.archived_at,
    membershipStatus: row.status,
    displayStatus: row.displayStatus,
    email: row.email,
    authEmailConfirmed: row.authEmailConfirmed,
  });
  const canSetup = canSendStaffSetupLink({
    profileId: row.profile_id,
    archivedAt: row.archived_at,
    membershipStatus: row.status,
    displayStatus: row.displayStatus,
    email: row.email,
    authEmailConfirmed: row.authEmailConfirmed,
  });
  const canActiveReset = canSendActiveStaffPasswordReset({
    profileId: row.profile_id,
    archivedAt: row.archived_at,
    membershipStatus: row.status,
    displayStatus: row.displayStatus,
    email: row.email,
  });
  const showSendOrResend =
    canSendNew ||
    canResend ||
    canSetup ||
    (!hasEmail && !row.profile_id && !isArchived && !isDisabled);
  const canCopyLink =
    Boolean(inviteUrl) &&
    (row.displayStatus === "invitation_sent" || row.displayStatus === "opened");

  const handledLifecycle = useRef<string | null>(null);
  useEffect(() => {
    const key = deactivateState?.ok
      ? `deact:${deactivateState.message}`
      : reactivateState?.ok
        ? `react:${reactivateState.message}`
        : archiveState?.ok
          ? `arch:${archiveState.message}`
          : deleteState?.ok
            ? `del:${deleteState.message}`
            : null;
    if (!key || handledLifecycle.current === key) return;
    handledLifecycle.current = key;
    onToast(
      "success",
      deactivateState?.ok
        ? (deactivateState.message ?? "Staff deactivated.")
        : reactivateState?.ok
          ? (reactivateState.message ?? "Staff reactivated.")
          : archiveState?.ok
            ? (archiveState.message ?? "Staff archived.")
            : (deleteState?.message ?? "Staff deleted."),
    );
    router.refresh();
  }, [
    deactivateState?.ok,
    reactivateState?.ok,
    archiveState?.ok,
    deleteState?.ok,
    deactivateState?.message,
    reactivateState?.message,
    archiveState?.message,
    deleteState?.message,
    onToast,
    router,
  ]);

  const handledResend = useRef<string | null>(null);
  useEffect(() => {
    const state = setupState ?? resendState;
    if (!state) return;
    const key = `${state.ok}:${state.message}`;
    if (handledResend.current === key) return;
    handledResend.current = key;
    onToast(state.ok ? "success" : "error", state.message);
    if (state.ok) router.refresh();
  }, [resendState, setupState, onToast, router]);

  const confirmOpen: ConfirmKind =
    confirm === "deactivate" && deactivateState?.ok
      ? null
      : confirm === "reactivate" && reactivateState?.ok
        ? null
        : confirm === "archive" && archiveState?.ok
          ? null
          : confirm === "delete" && deleteState?.ok
            ? null
            : confirm;

  function openEdit(opts?: { email?: boolean }) {
    setFocusEmail(Boolean(opts?.email));
    setEditOpen(true);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            disabled={pending}
            aria-label={`Actions for ${row.full_name}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {!isArchived ? (
            <DropdownMenuItem disabled={pending} onSelect={() => openEdit()}>
              Edit staff
            </DropdownMenuItem>
          ) : null}
          {!isArchived && !row.profile_id ? (
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => openEdit({ email: true })}
            >
              {hasEmail ? "Change email" : "Add email"}
            </DropdownMenuItem>
          ) : null}
          {row.role === "teacher" && !isDisabled && !isArchived ? (
            <>
              <DropdownMenuItem disabled={pending} onSelect={() => setGradesOpen(true)}>
                Manage grade levels
              </DropdownMenuItem>
              <DropdownMenuItem disabled={pending} onSelect={() => setClassesOpen(true)}>
                Manage classes
              </DropdownMenuItem>
            </>
          ) : null}
          {showSendOrResend ? (
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => {
                if (!hasEmail) {
                  openEdit({ email: true });
                  return;
                }
                const fd = new FormData();
                fd.set("staffMemberId", row.id);
                if (canSetup) {
                  setupAction(fd);
                  return;
                }
                resendAction(fd);
              }}
            >
              {!hasEmail
                ? "Send invitation (add email…)"
                : canSetup
                  ? setupPending
                    ? "Sending…"
                    : "Send setup link"
                  : canResend
                    ? resendPending
                      ? "Resending…"
                      : "Resend invitation"
                    : "Send invitation"}
            </DropdownMenuItem>
          ) : null}
          {canActiveReset ? (
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => {
                const fd = new FormData();
                fd.set("staffMemberId", row.id);
                setupAction(fd);
              }}
            >
              {setupPending ? "Sending…" : "Send password reset"}
            </DropdownMenuItem>
          ) : null}
          {canCopyLink ? (
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => {
                void navigator.clipboard.writeText(inviteUrl).then(() => {
                  setLinkCopiedFlash(true);
                  onToast("success", "Invitation link copied.");
                  setTimeout(() => setLinkCopiedFlash(false), 2000);
                });
              }}
            >
              Copy invitation link
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {isDisabled ? (
            <DropdownMenuItem
              disabled={pending || isSelf}
              onSelect={() => setConfirm("reactivate")}
            >
              Reactivate
            </DropdownMenuItem>
          ) : !isArchived ? (
            <DropdownMenuItem
              disabled={pending || isSelf}
              onSelect={() => setConfirm("deactivate")}
            >
              Deactivate
            </DropdownMenuItem>
          ) : null}
          {!isArchived ? (
            <DropdownMenuItem
              disabled={pending || isSelf}
              onSelect={() => setConfirm("archive")}
            >
              Archive
            </DropdownMenuItem>
          ) : null}
          {canDeletePermanently ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={pending || isSelf}
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirm("delete")}
              >
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setFocusEmail(false);
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          {editOpen ? (
            <EditStaffForm
              row={row}
              focusEmail={focusEmail}
              assignedGrades={grades}
              assignedClasses={assigned}
              availableGrades={availableGrades}
              availableClasses={availableClasses}
              onClose={() => {
                setEditOpen(false);
                setFocusEmail(false);
              }}
              onSuccess={(message) => {
                onToast("success", message);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {row.role === "teacher" ? (
        <>
          <StaffMemberGradesDialog
            staffMemberId={row.id}
            teacherLabel={row.full_name}
            assigned={grades}
            availableGrades={availableGrades}
            open={gradesOpen}
            onOpenChange={setGradesOpen}
          />
          <StaffMemberClassesDialog
            staffMemberId={row.id}
            teacherLabel={row.full_name}
            assigned={assigned}
            availableClasses={availableClasses}
            assignedGradeIds={gradeIds}
            open={classesOpen}
            onOpenChange={setClassesOpen}
          />
        </>
      ) : null}

      <Dialog
        open={confirmOpen === "deactivate"}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {row.full_name}?</DialogTitle>
            <DialogDescription>
              They lose sign-in access. Historical records remain. Pending invitations are
              withdrawn.
            </DialogDescription>
          </DialogHeader>
          <form action={deactivateAction}>
            <input type="hidden" name="staffMemberId" value={row.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={deactivatePending}>
                {deactivatePending ? "Deactivating…" : "Deactivate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen === "reactivate"}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactivate {row.full_name}?</DialogTitle>
            <DialogDescription>
              Restores directory access. If they have a linked account, sign-in is enabled again.
            </DialogDescription>
          </DialogHeader>
          <form action={reactivateAction}>
            <input type="hidden" name="staffMemberId" value={row.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={reactivatePending}>
                {reactivatePending ? "Reactivating…" : "Reactivate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen === "archive"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {row.full_name}?</DialogTitle>
            <DialogDescription>
              Removes them from the active directory roster. Linked accounts are deactivated.
            </DialogDescription>
          </DialogHeader>
          <form action={archiveAction}>
            <input type="hidden" name="staffMemberId" value={row.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={archivePending}>
                {archivePending ? "Archiving…" : "Archive"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete {row.full_name}?</DialogTitle>
            <DialogDescription>{STAFF_DELETE_CONFIRM_HINT}</DialogDescription>
          </DialogHeader>
          <form action={deleteAction}>
            <input type="hidden" name="staffMemberId" value={row.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deletePending}>
                {deletePending ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {linkCopiedFlash ? (
        <p className="text-primary mt-1 text-xs" role="status">
          Invitation link copied.
        </p>
      ) : null}
      {resendState?.ok && resendState.results[0]?.inviteUrl ? (
        <div className="mt-1">
          <CopyTextButton
            text={resendState.results[0].inviteUrl}
            label="Copy new link"
            size="sm"
          />
        </div>
      ) : null}
    </>
  );
}

export function StaffDirectoryTable({
  rows,
  role,
  currentUserId,
  assignmentsByMember,
  gradesByMember,
  availableGrades,
  availableClasses,
  deletableByStaffMemberId,
  loginBaseUrl,
}: StaffDirectoryTableProps) {
  const { toast, showToast } = useWorkspaceToast();

  if (rows.length === 0) {
    return (
      <ListEmptyState
        icon={Users}
        title="No staff on the roster"
        description="Add staff to build the school, then send invitations when they should activate."
      />
    );
  }

  return (
    <>
      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm shadow-md">
          <WorkspaceToast toast={toast} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[18%]">Name</TableHead>
            <TableHead className="w-[16%]">Email</TableHead>
            <TableHead className="w-[10%]">Role</TableHead>
            <TableHead className="w-[12%]">Grade levels</TableHead>
            <TableHead className="w-[12%]">Classes</TableHead>
            <TableHead className="w-[12%]">Access status</TableHead>
            <TableHead className="w-[10%]">Last activity</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const assigned = assignmentsByMember.get(row.id) ?? [];
            const grades = gradesByMember.get(row.id) ?? [];
            const muted =
              row.displayStatus === "disabled" ||
              row.displayStatus === "draft" ||
              row.displayStatus === "archived";
            const canDelete =
              (row.displayStatus === "disabled" ||
                row.displayStatus === "archived" ||
                !row.profile_id) &&
              (deletableByStaffMemberId[row.id] ?? !row.profile_id);

            return (
              <DirectoryClickableRow key={row.id}>
                <TableCell>
                  <DirectoryRowHitTarget
                    href={staffProfilePath(role, row.id)}
                    label={`Open ${row.full_name}`}
                  />
                  <Link
                    href={staffProfilePath(role, row.id)}
                    className="ns-table-primary relative z-[2] block min-w-0 rounded-sm focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <DirectoryPeopleCell name={row.full_name} muted={muted} />
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground relative z-[2] text-sm">
                  {row.email?.trim() ? (
                    row.email
                  ) : (
                    <span className="text-foreground/70 italic">Not added</span>
                  )}
                </TableCell>
                <TableCell className="relative z-[2] text-sm">
                  {isRole(row.role) ? roleLabels[row.role] : row.role}
                </TableCell>
                <TableCell className="text-muted-foreground relative z-[2] text-sm">
                  {row.role === "teacher" ? formatStaffAssignedGradesSummary(grades) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground relative z-[2] text-sm">
                  {row.role === "teacher" ? formatStaffAssignedClassesSummary(assigned) : "—"}
                </TableCell>
                <TableCell className="relative z-[2]">
                  <StaffInviteStatusCell row={row} onToast={showToast} />
                </TableCell>
                <TableCell className="text-muted-foreground relative z-[2] text-sm">
                  {formatLastActivity(row.last_activity_at)}
                </TableCell>
                <TableCell className="relative z-10 w-12 text-right">
                  <StaffRowActions
                    row={row}
                    currentUserId={currentUserId}
                    assigned={assigned}
                    grades={grades}
                    availableGrades={availableGrades}
                    availableClasses={availableClasses}
                    canDeletePermanently={canDelete}
                    loginBaseUrl={loginBaseUrl}
                    onToast={showToast}
                  />
                </TableCell>
              </DirectoryClickableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
