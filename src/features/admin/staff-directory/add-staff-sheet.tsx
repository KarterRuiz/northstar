"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
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
import { WorkspaceToast, useWorkspaceToast } from "@/components/workspace/workspace-toast";
import { AdminTeacherInviteAssignedClasses } from "@/features/admin/staff-directory/admin-assigned-classes-field";
import { AdminStaffGradeLevelsField } from "@/features/admin/staff-directory/admin-assigned-grade-levels-field";
import type {
  ClassInviteOption,
  GradeInviteOption,
} from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import {
  createStaffMemberAction,
  type StaffMemberActionState,
} from "@/features/admin/staff-directory/staff-members-actions";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "teacher", label: "Teacher" },
  { value: "registrar", label: "Registrar" },
  { value: "vice_principal", label: "Vice principal" },
  { value: "principal", label: "School leadership (principal)" },
  { value: "admin", label: "Admin" },
];

type AddStaffSheetProps = {
  gradeOptions: GradeInviteOption[];
  classOptions: ClassInviteOption[];
};

function AddStaffFormBody({
  onSuccess,
  gradeOptions,
  classOptions,
}: {
  onSuccess: (message: string) => void;
  gradeOptions: GradeInviteOption[];
  classOptions: ClassInviteOption[];
}) {
  const [role, setRole] = useState<Role>("teacher");
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([]);
  const handledSuccess = useRef(false);
  const [state, formAction, pending] = useActionState<
    StaffMemberActionState | undefined,
    FormData
  >(createStaffMemberAction, undefined);

  useEffect(() => {
    if (state?.ok && !handledSuccess.current) {
      handledSuccess.current = true;
      onSuccess(state.message ?? "Staff added to the directory.");
    }
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="flex flex-col gap-5 pt-2">
      {/* Identity */}
      <fieldset className="space-y-4">
        <legend className="text-foreground text-sm font-medium">Identity</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="add-staff-first-name">First name</Label>
            <Input
              id="add-staff-first-name"
              name="firstName"
              autoComplete="given-name"
              required
              disabled={pending}
              placeholder="Jordan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-staff-last-name">Last name</Label>
            <Input
              id="add-staff-last-name"
              name="lastName"
              autoComplete="family-name"
              required
              disabled={pending}
              placeholder="Lee"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-staff-email">
            Email address <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="add-staff-email"
            name="email"
            type="email"
            autoComplete="email"
            disabled={pending}
            placeholder="teacher@example.com"
          />
          <p className="text-muted-foreground text-xs">
            Optional for roster planning. Required later when you send an invitation — no invite is
            sent now.
          </p>
        </div>
      </fieldset>

      {/* Role */}
      <div className="space-y-2">
        <Label htmlFor="add-staff-role">Dashboard role</Label>
        <select
          id="add-staff-role"
          name="role"
          required
          disabled={pending}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grades → Classes */}
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

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="add-staff-note">Notes (optional)</Label>
        <Input
          id="add-staff-note"
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
        {pending ? "Saving…" : "Add staff"}
      </Button>
    </form>
  );
}

export function AddStaffSheet({ gradeOptions, classOptions }: AddStaffSheetProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();

  return (
    <>
      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm shadow-md">
          <WorkspaceToast toast={toast} />
        </div>
      ) : null}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button type="button" className="gap-2">
            <UserPlus className="h-4 w-4" aria-hidden />
            Add staff
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add staff</SheetTitle>
            <SheetDescription>
              Build the school roster first — role, grades, and classes. Invitations activate access
              later.
            </SheetDescription>
          </SheetHeader>
          {open ? (
            <AddStaffFormBody
              gradeOptions={gradeOptions}
              classOptions={classOptions}
              onSuccess={(message) => {
                showToast("success", message);
                setOpen(false);
                router.refresh();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
