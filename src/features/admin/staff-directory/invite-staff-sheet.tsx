"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { CopyTextButton } from "@/components/ui/copy-text-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AdminTeacherInviteAssignedClasses } from "@/features/admin/staff-directory/admin-assigned-classes-field";
import { AdminStaffGradeLevelsField } from "@/features/admin/staff-directory/admin-assigned-grade-levels-field";
import type {
  ClassInviteOption,
  GradeInviteOption,
} from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import {
  createStaffInvitationAction,
  type StaffInvitationActionState,
} from "@/features/admin/staff-directory/staff-invitations-actions";

const INVITE_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "teacher", label: "Teacher" },
  { value: "registrar", label: "Registrar" },
  { value: "vice_principal", label: "Vice principal" },
  { value: "principal", label: "School leadership (principal)" },
  { value: "admin", label: "Admin" },
];

type InviteStaffSheetProps = {
  gradeOptions: GradeInviteOption[];
  classOptions: ClassInviteOption[];
};

function InviteStaffFormBody({
  onClose,
  gradeOptions,
  classOptions,
}: {
  onClose: () => void;
  gradeOptions: GradeInviteOption[];
  classOptions: ClassInviteOption[];
}) {
  const [role, setRole] = useState<Role>("teacher");
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState<
    StaffInvitationActionState | undefined,
    FormData
  >(createStaffInvitationAction, undefined);

  if (state?.ok) {
    const inviteUrl = state.inviteUrl || state.recoveryUrl;
    return (
      <div className="flex flex-col gap-4 pt-2">
        <p className="text-primary text-sm font-medium" role="status">
          {state.message}
        </p>
        {state.setupSummary ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{state.setupSummary}</p>
        ) : null}
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-foreground text-xs font-medium uppercase tracking-wide">
            Invite link
          </p>
          <p className="text-muted-foreground text-xs">
            Share this if they did not get the email, or to open sign-in directly.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-muted max-w-full flex-1 truncate rounded px-2 py-1 text-xs">
              {inviteUrl}
            </code>
            <CopyTextButton text={inviteUrl} label="Copy invite link" />
          </div>
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-foreground text-xs font-medium uppercase tracking-wide">
            Invited email
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-muted max-w-full flex-1 truncate rounded px-2 py-1 text-xs">
              {state.invitedEmail}
            </code>
            <CopyTextButton text={state.invitedEmail} label="Copy email" />
          </div>
        </div>
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 pt-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-first-name">First name</Label>
          <Input
            id="invite-first-name"
            name="firstName"
            autoComplete="given-name"
            required
            disabled={pending}
            placeholder="Jordan"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-last-name">Last name</Label>
          <Input
            id="invite-last-name"
            name="lastName"
            autoComplete="family-name"
            required
            disabled={pending}
            placeholder="Lee"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email address</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          placeholder="teacher@example.com"
          aria-describedby="invite-email-hint"
        />
        <p id="invite-email-hint" className="text-muted-foreground text-xs">
          Use the email this staff member will use to sign in (matched lowercase + trimmed).
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-role">Dashboard role</Label>
        <select
          id="invite-role"
          name="role"
          required
          disabled={pending}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {INVITE_ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {role === "teacher" ? (
        <>
          <AdminStaffGradeLevelsField
            options={gradeOptions}
            disabled={pending}
            onSelectedIdsChange={setSelectedGradeIds}
          />
          <AdminTeacherInviteAssignedClasses
            options={classOptions}
            disabled={pending}
            allowedGradeLevelIds={selectedGradeIds}
          />
        </>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="invite-note">Note to include in your own follow-up (optional)</Label>
        <Input
          id="invite-note"
          name="staffNote"
          disabled={pending}
          placeholder="Starts Monday — laptop ready in room 204"
          maxLength={500}
        />
      </div>
      {state && !state.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Working…" : "Create & send invitation"}
      </Button>
    </form>
  );
}

/**
 * Legacy combined create+invite path (email required — sends invitation immediately).
 * Prefer Add staff + Send invitations on the staff directory.
 */
export function InviteStaffSheet({ gradeOptions, classOptions }: InviteStaffSheetProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <UserPlus className="h-4 w-4" aria-hidden />
          Create & invite
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create & send invitation</SheetTitle>
          <SheetDescription>
            Legacy path that creates a roster row and sends an invitation in one step. Prefer Add
            staff, then Send invitations, so you can build the roster without email.
          </SheetDescription>
        </SheetHeader>
        {open ? (
          <InviteStaffFormBody
            gradeOptions={gradeOptions}
            classOptions={classOptions}
            onClose={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
