"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MoreHorizontal } from "lucide-react";

import { isRole, roleLabels, type Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { AdminTeacherInviteAssignedClasses } from "@/features/admin/staff-directory/admin-assigned-classes-field";
import { AdminStaffGradeLevelsField } from "@/features/admin/staff-directory/admin-assigned-grade-levels-field";
import type {
  ClassInviteOption,
  GradeInviteOption,
} from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type {
  StaffClassAssignmentRow,
  StaffGradeAccessRow,
  StaffMemberRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import {
  StaffMemberClassesDialog,
  StaffMemberGradesDialog,
} from "@/features/admin/staff-directory/staff-member-access-dialogs";
import {
  archiveStaffMemberAction,
  deactivateStaffMemberAction,
  reactivateStaffMemberAction,
  updateStaffMemberAction,
  type StaffMemberActionState,
} from "@/features/admin/staff-directory/staff-members-actions";
import {
  resendStaffMemberInvitationAction,
  type SendStaffInvitationsState,
} from "@/features/admin/staff-directory/send-staff-invitations-actions";
import { buildStaffInviteLink } from "@/lib/staff/staff-invite-link";
import { canSendStaffInvitation } from "@/lib/staff/staff-roster-status";
import { WorkspaceToast, useWorkspaceToast } from "@/components/workspace/workspace-toast";

const EDIT_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "teacher", label: "Teacher" },
  { value: "registrar", label: "Registrar" },
  { value: "vice_principal", label: "Vice principal" },
  { value: "principal", label: "School leadership (principal)" },
  { value: "admin", label: "Admin" },
];

const selectClassName =
  "border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

type StaffProfileActionsProps = {
  member: StaffMemberRow;
  currentUserId: string;
  grades: StaffGradeAccessRow[];
  classes: StaffClassAssignmentRow[];
  availableGrades: GradeInviteOption[];
  availableClasses: ClassInviteOption[];
  loginBaseUrl?: string;
};

export function StaffProfileActions({
  member,
  currentUserId,
  grades,
  classes,
  availableGrades,
  availableClasses,
  loginBaseUrl,
}: StaffProfileActionsProps) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const [editOpen, setEditOpen] = useState(false);
  const [gradesOpen, setGradesOpen] = useState(false);
  const [classesOpen, setClassesOpen] = useState(false);
  const [confirm, setConfirm] = useState<
    "deactivate" | "reactivate" | "archive" | null
  >(null);

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
  const [resendState, resendAction, resendPending] = useActionState<
    SendStaffInvitationsState | undefined,
    FormData
  >(resendStaffMemberInvitationAction, undefined);

  const isSelf = member.profile_id === currentUserId;
  const isArchived = member.displayStatus === "archived";
  const isDisabled = member.displayStatus === "disabled";
  const hasEmail = Boolean(member.email?.trim());
  const gradeIds = grades.map((g) => g.gradeLevelId);
  const pending =
    deactivatePending || reactivatePending || archivePending || resendPending;

  const latestInviteForEligibility =
    member.displayStatus === "invitation_sent" || member.displayStatus === "opened"
      ? { status: "pending" as const, expires_at: null as string | null }
      : member.inviteStatus
        ? { status: member.inviteStatus, expires_at: null as string | null }
        : null;

  const canSendNew = canSendStaffInvitation({
    membershipStatus: member.status,
    archivedAt: member.archived_at,
    profileId: member.profile_id,
    email: member.email,
    latestInvite: latestInviteForEligibility,
  });
  const canResend =
    !member.profile_id &&
    !isArchived &&
    !isDisabled &&
    (member.displayStatus === "invitation_sent" ||
      member.displayStatus === "opened") &&
    hasEmail;
  const showSendOrResend =
    (canSendNew || canResend) && !isArchived && !isDisabled;
  const canCopyLink =
    Boolean(member.inviteToken) &&
    !member.profile_id &&
    !isArchived &&
    Boolean(loginBaseUrl);

  const handled = useRef<string | null>(null);
  useEffect(() => {
    const key = deactivateState?.ok
      ? `d:${deactivateState.message}`
      : reactivateState?.ok
        ? `r:${reactivateState.message}`
        : archiveState?.ok
          ? `a:${archiveState.message}`
          : resendState?.ok
            ? `i:${resendState.message}`
            : null;
    if (!key || handled.current === key) return;
    handled.current = key;
    const msg =
      (deactivateState?.ok && deactivateState.message) ||
      (reactivateState?.ok && reactivateState.message) ||
      (archiveState?.ok && archiveState.message) ||
      (resendState?.ok && resendState.message) ||
      "Done.";
    showToast("success", msg);
    setConfirm(null);
    router.refresh();
  }, [
    deactivateState,
    reactivateState,
    archiveState,
    resendState,
    router,
    showToast,
  ]);

  useEffect(() => {
    const err =
      (deactivateState && !deactivateState.ok && deactivateState.message) ||
      (reactivateState && !reactivateState.ok && reactivateState.message) ||
      (archiveState && !archiveState.ok && archiveState.message) ||
      (resendState && !resendState.ok && resendState.message);
    if (err) showToast("error", err);
  }, [deactivateState, reactivateState, archiveState, resendState, showToast]);

  return (
    <>
      <WorkspaceToast toast={toast} />

      <div className="flex w-full flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {!isArchived ? (
            <Button
              type="button"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => setEditOpen(true)}
            >
              Edit staff
            </Button>
          ) : null}
          {member.role === "teacher" && !isArchived && !isDisabled ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  Manage assignments
                  <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setGradesOpen(true)}>
                  Grade levels
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setClassesOpen(true)}>
                  Classes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-between sm:w-auto"
              disabled={pending}
            >
              Actions
              <MoreHorizontal className="size-4 opacity-70" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {showSendOrResend ? (
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => {
                  if (!hasEmail) {
                    setEditOpen(true);
                    return;
                  }
                  const fd = new FormData();
                  fd.set("staffMemberId", member.id);
                  resendAction(fd);
                }}
              >
                {!hasEmail
                  ? "Send invite (add email…)"
                  : canResend
                    ? "Resend invite"
                    : "Send invite"}
              </DropdownMenuItem>
            ) : null}
            {canCopyLink && member.inviteToken && loginBaseUrl ? (
              <DropdownMenuItem
                onSelect={() => {
                  const url = buildStaffInviteLink(loginBaseUrl, member.inviteToken!);
                  void navigator.clipboard.writeText(url).then(() => {
                    showToast("success", "Invitation link copied.");
                  });
                }}
              >
                Copy invitation link
              </DropdownMenuItem>
            ) : null}
            {(showSendOrResend || canCopyLink) && !isSelf ? (
              <DropdownMenuSeparator />
            ) : null}
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <EditStaffDialogBody
            member={member}
            grades={grades}
            classes={classes}
            availableGrades={availableGrades}
            availableClasses={availableClasses}
            onClose={() => setEditOpen(false)}
            onSuccess={(message) => {
              showToast("success", message);
              setEditOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <StaffMemberGradesDialog
        staffMemberId={member.id}
        teacherLabel={member.full_name}
        assigned={grades}
        availableGrades={availableGrades}
        open={gradesOpen}
        onOpenChange={setGradesOpen}
      />
      <StaffMemberClassesDialog
        staffMemberId={member.id}
        teacherLabel={member.full_name}
        assigned={classes}
        availableClasses={availableClasses}
        assignedGradeIds={gradeIds}
        open={classesOpen}
        onOpenChange={setClassesOpen}
      />

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirm === "reactivate"
                ? "Reactivate staff?"
                : confirm === "archive"
                  ? "Archive staff?"
                  : "Deactivate staff?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "reactivate"
                ? `Restore access for ${member.full_name}.`
                : confirm === "archive"
                  ? `Archive ${member.full_name} from the active roster. History is retained.`
                  : `Turn off access for ${member.full_name}. The roster row remains.`}
            </DialogDescription>
          </DialogHeader>
          <form
            action={
              confirm === "reactivate"
                ? reactivateAction
                : confirm === "archive"
                  ? archiveAction
                  : deactivateAction
            }
          >
            <input type="hidden" name="staffMemberId" value={member.id} />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirm(null)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Working…"
                  : confirm === "reactivate"
                    ? "Reactivate"
                    : confirm === "archive"
                      ? "Archive"
                      : "Deactivate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditStaffDialogBody({
  member,
  grades,
  classes,
  availableGrades,
  availableClasses,
  onClose,
  onSuccess,
}: {
  member: StaffMemberRow;
  grades: StaffGradeAccessRow[];
  classes: StaffClassAssignmentRow[];
  availableGrades: GradeInviteOption[];
  availableClasses: ClassInviteOption[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const handledSuccess = useRef(false);
  const [firstName, setFirstName] = useState(member.first_name);
  const [lastName, setLastName] = useState(member.last_name);
  const [email, setEmail] = useState(member.email ?? "");
  const [selectedRole, setSelectedRole] = useState<Role>(
    isRole(member.role) ? member.role : "teacher",
  );
  const [notes, setNotes] = useState(member.notes ?? "");
  const [selectedGradeIds, setSelectedGradeIds] = useState(() =>
    grades.map((g) => g.gradeLevelId),
  );

  const [state, formAction, pending] = useActionState<
    StaffMemberActionState | undefined,
    FormData
  >(updateStaffMemberAction, undefined);

  useEffect(() => {
    if (state?.ok && !handledSuccess.current) {
      handledSuccess.current = true;
      onSuccess(state.message ?? "Staff updated.");
    }
  }, [state, onSuccess]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit staff member</DialogTitle>
        <DialogDescription>
          Update roster details for {member.full_name}.
          {isRole(member.role) ? ` Current role: ${roleLabels[member.role]}.` : null}
        </DialogDescription>
      </DialogHeader>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="staffMemberId" value={member.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sp-first">First name</Label>
            <Input
              id="sp-first"
              name="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-last">Last name</Label>
            <Input
              id="sp-last"
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              disabled={pending}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp-email">Email</Label>
          <Input
            id="sp-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            placeholder="Optional until inviting"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp-role">Role</Label>
          <select
            id="sp-role"
            name="role"
            className={selectClassName}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as Role)}
            disabled={pending}
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
              options={availableGrades}
              disabled={pending}
              initialSelectedIds={selectedGradeIds}
              onSelectedIdsChange={setSelectedGradeIds}
            />
            <AdminTeacherInviteAssignedClasses
              options={availableClasses}
              disabled={pending}
              initialSelectedIds={classes.map((c) => c.classId)}
              allowedGradeLevelIds={selectedGradeIds}
            />
          </>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="sp-notes">Notes</Label>
          <Textarea
            id="sp-notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
            rows={3}
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
