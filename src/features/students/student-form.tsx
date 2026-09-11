"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useActionState, useMemo, useRef, useState } from "react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatusForm,
} from "@/features/students/enrollment-constants";
import {
  createStudentAction,
  updateStudentAction,
  type StudentMutationState,
} from "@/features/students/student-mutations-actions";
import { transferClassConfirmMessage, pickPreferredEnrollmentForEdit } from "@/features/students/transfer-student-enrollment";
import { cn } from "@/lib/utils";

import type { StudentClassOption, StudentEnrollmentChoice } from "./student-form-queries";
import { STUDENT_NUMBER_MAX } from "./student-number";

const NAME_MAX = 120;
const EXTERNAL_ID_MAX = STUDENT_NUMBER_MAX;

/** Matches `Input` control chrome for native `<select>` elements. */
const nativeSelectClassName = cn(
  "border-input bg-background ring-offset-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
);

type StudentFormProps = {
  dashboardRole: Role;
  mode: "create" | "edit";
  studentId?: string;
  classOptions: StudentClassOption[];
  initialFirstName?: string;
  initialLastName?: string;
  initialPreferredName?: string;
  initialExternalId?: string;
  initialClassId?: string;
  initialEnrollmentStatus?: string;
  enrollmentChoices?: StudentEnrollmentChoice[];
};

function statusLabel(s: string): string {
  return s.replaceAll("_", " ");
}

function coerceStatus(raw: string): EnrollmentStatusForm {
  const t = raw.trim();
  return (ENROLLMENT_STATUSES as readonly string[]).includes(t)
    ? (t as EnrollmentStatusForm)
    : "active";
}

function FieldGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>{children}</div>;
}

function classLabelFor(
  classId: string,
  classOptions: StudentClassOption[],
  enrollmentChoices: StudentEnrollmentChoice[],
): string {
  const fromOptions = classOptions.find((c) => c.id === classId)?.label;
  if (fromOptions) return fromOptions;
  const fromEn = enrollmentChoices.find((c) => c.classId === classId)?.label;
  return fromEn ?? "selected class";
}

export function StudentForm({
  dashboardRole,
  mode,
  studentId,
  classOptions,
  initialFirstName = "",
  initialLastName = "",
  initialPreferredName = "",
  initialExternalId = "",
  initialClassId = "",
  initialEnrollmentStatus = "active",
  enrollmentChoices = [],
}: StudentFormProps) {
  const action = mode === "create" ? createStudentAction : updateStudentAction;
  const [state, formAction, pending] = useActionState<
    StudentMutationState | undefined,
    FormData
  >(action, undefined);

  const multiEnrollment = mode === "edit" && enrollmentChoices.length > 1;

  const preferredChoice = pickPreferredEnrollmentForEdit(enrollmentChoices);
  const firstChoice = preferredChoice ?? enrollmentChoices[0];

  const [pickedEnrollmentId, setPickedEnrollmentId] = useState(
    firstChoice?.id ?? "",
  );

  const [classId, setClassId] = useState(
    firstChoice?.classId ?? initialClassId,
  );
  const [enrollmentStatus, setEnrollmentStatus] = useState(
    coerceStatus(firstChoice?.status ?? initialEnrollmentStatus),
  );
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  /** True from confirm click until action settles (covers the gap before `pending`). */
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  /** Sync lock so confirm cannot fire twice in the same tick. */
  const transferSubmitLock = useRef(false);

  const choiceById = useMemo(() => {
    const m = new Map<string, StudentEnrollmentChoice>();
    for (const c of enrollmentChoices) m.set(c.id, c);
    return m;
  }, [enrollmentChoices]);

  const handleEnrollmentPick = (enrollmentId: string) => {
    setPickedEnrollmentId(enrollmentId);
    const row = choiceById.get(enrollmentId);
    if (row) {
      setClassId(row.classId);
      setEnrollmentStatus(coerceStatus(row.status));
    }
  };

  const defaultEnrollmentId =
    enrollmentChoices.length === 1 ? enrollmentChoices[0]!.id : "";

  const sourceEnrollment =
    mode === "edit"
      ? choiceById.get(pickedEnrollmentId || defaultEnrollmentId) ?? firstChoice
      : undefined;
  const sourceClassId = sourceEnrollment?.classId ?? initialClassId;

  const profileHref =
    state?.ok && state.studentId
      ? `/dashboard/${dashboardRole}/students/${state.studentId}/overview`
      : studentId
        ? `/dashboard/${dashboardRole}/students/${studentId}/overview`
        : null;

  const selectClassProps = multiEnrollment
    ? ({
        value: classId,
        onChange: (e: ChangeEvent<HTMLSelectElement>) =>
          setClassId(e.target.value),
      } as const)
    : ({
        value: classId || initialClassId,
        onChange: (e: ChangeEvent<HTMLSelectElement>) =>
          setClassId(e.target.value),
      } as const);

  const selectStatusProps = multiEnrollment
    ? ({
        value: enrollmentStatus,
        onChange: (e: ChangeEvent<HTMLSelectElement>) =>
          setEnrollmentStatus(coerceStatus(e.target.value)),
      } as const)
    : ({
        defaultValue: coerceStatus(initialEnrollmentStatus),
      } as const);

  const directoryHref = `/dashboard/${dashboardRole}/students`;

  const studentDisplayName =
    [initialPreferredName || initialFirstName, initialLastName]
      .filter(Boolean)
      .join(" ")
      .trim() || undefined;

  const transferConfirmCopy =
    sourceClassId && classId && sourceClassId !== classId
      ? transferClassConfirmMessage({
          studentDisplayName,
          fromClassLabel: classLabelFor(sourceClassId, classOptions, enrollmentChoices),
          toClassLabel: classLabelFor(classId, classOptions, enrollmentChoices),
        })
      : "";

  const transferFailed = Boolean(state && !state.ok);
  const transferInFlight =
    pending || (transferSubmitting && !transferFailed);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (mode !== "edit") return;
    // Block native re-submit while a confirmed transfer is in flight (click-through
    // onto Save after the dialog closes used to enqueue a second transfer).
    if (transferInFlight) {
      event.preventDefault();
      return;
    }
    const form = event.currentTarget;
    const fd = new FormData(form);
    const nextClassId = String(fd.get("classId") ?? "").trim();
    const enrollmentId = String(fd.get("enrollmentId") ?? "").trim();
    const beforeClass =
      (enrollmentId ? choiceById.get(enrollmentId)?.classId : undefined) ??
      sourceClassId;
    if (enrollmentId && beforeClass && nextClassId && beforeClass !== nextClassId) {
      event.preventDefault();
      transferSubmitLock.current = false;
      setTransferSubmitting(false);
      setPendingFormData(fd);
      setTransferConfirmOpen(true);
    }
  }

  function confirmTransfer() {
    if (!pendingFormData || transferSubmitLock.current || transferInFlight) return;
    transferSubmitLock.current = true;
    setTransferSubmitting(true);
    const fd = pendingFormData;
    setPendingFormData(null);
    // Keep the dialog open (Transferring…) so the confirm click cannot fall
    // through onto Save and fire a second updateStudentAction.
    formAction(fd);
  }

  return (
    <>
      <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="dashboardRole" value={dashboardRole} />
        {mode === "edit" && studentId ? (
          <input type="hidden" name="studentId" value={studentId} />
        ) : null}
        {mode === "edit" && enrollmentChoices.length === 1 ? (
          <input type="hidden" name="enrollmentId" value={defaultEnrollmentId} />
        ) : null}

        {state && !state.ok ? (
          <p
            className="text-destructive bg-destructive/5 rounded-lg border border-destructive/20 px-3 py-2 text-sm"
            role="alert"
          >
            {state.message}
          </p>
        ) : null}
        {state?.ok ? (
          <div
            className="bg-primary/5 text-primary rounded-lg border border-primary/15 px-3 py-2 text-sm"
            role="status"
          >
            <p className="font-medium">{state.message ?? "Saved."}</p>
            {profileHref ? (
              <div className="mt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={profileHref}>Open student profile</Link>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader className="border-border/60 space-y-1 border-b px-4 py-3">
            <CardTitle className="text-base">Identity</CardTitle>
            <CardDescription className="text-xs leading-snug">
              Legal and display names as they should appear in the directory.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="student-first" className="text-xs font-medium">
                First name
              </Label>
              <Input
                id="student-first"
                name="firstName"
                required
                autoComplete="given-name"
                defaultValue={initialFirstName}
                maxLength={NAME_MAX}
              />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="student-last" className="text-xs font-medium">
                Last name
              </Label>
              <Input
                id="student-last"
                name="lastName"
                required
                autoComplete="family-name"
                defaultValue={initialLastName}
                maxLength={NAME_MAX}
              />
            </FieldGroup>
            <FieldGroup className="sm:col-span-2">
              <Label htmlFor="student-preferred" className="text-xs font-medium">
                Preferred name <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="student-preferred"
                name="preferredName"
                autoComplete="nickname"
                defaultValue={initialPreferredName}
                maxLength={NAME_MAX}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-border/60 space-y-1 border-b px-4 py-3">
            <CardTitle className="text-base">Enrollment</CardTitle>
            <CardDescription className="text-xs leading-snug">
              {mode === "edit"
                ? "Changing class transfers placement: the previous enrollment stays withdrawn with its class history, and a new active enrollment is created. Status-only edits on the same class do not move history."
                : "Class placement and status for the current school year (grade follows the class)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            {mode === "edit" && enrollmentChoices.length > 1 ? (
              <FieldGroup className="sm:col-span-2">
                <Label htmlFor="student-enrollment-pick" className="text-xs font-medium">
                  Enrollment record to update
                </Label>
                <select
                  id="student-enrollment-pick"
                  name="enrollmentId"
                  required
                  className={nativeSelectClassName}
                  value={pickedEnrollmentId}
                  onChange={(e) => handleEnrollmentPick(e.target.value)}
                >
                  {enrollmentChoices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.status})
                    </option>
                  ))}
                </select>
              </FieldGroup>
            ) : null}

            <FieldGroup className="sm:col-span-2">
              <Label htmlFor="student-class" className="text-xs font-medium">
                Class
              </Label>
              <select
                id="student-class"
                name="classId"
                required
                className={nativeSelectClassName}
                {...selectClassProps}
              >
                <option value="" disabled>
                  Select a class…
                </option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup className="sm:col-span-2 sm:max-w-xs">
              <Label htmlFor="student-enrollment-status" className="text-xs font-medium">
                Enrollment status
              </Label>
              <select
                id="student-enrollment-status"
                name="enrollmentStatus"
                required
                className={cn(nativeSelectClassName, "capitalize")}
                {...selectStatusProps}
              >
                {ENROLLMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
              {mode === "edit" && sourceClassId && classId && sourceClassId !== classId ? (
                <p className="text-muted-foreground text-xs leading-snug">
                  Class change uses transfer semantics; destination enrollment will be active.
                  Status above applies only when keeping the same class.
                </p>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-border/60 space-y-1 border-b px-4 py-3">
            <CardTitle className="text-base">Student Number</CardTitle>
            <CardDescription className="text-xs leading-snug">
              School-wide permanent identifier (portable). Distinct from class Roster # and
              from the internal Northstar Record ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <FieldGroup className="max-w-xl">
              <Label htmlFor="student-external" className="text-xs font-medium">
                Student Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="student-external"
                name="externalId"
                className="font-mono text-sm"
                defaultValue={initialExternalId}
                maxLength={EXTERNAL_ID_MAX}
                required
                placeholder="School-provided Student Number"
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Button variant="outline" type="button" asChild>
            <Link href={directoryHref}>Back to directory</Link>
          </Button>
          <Button type="submit" disabled={transferInFlight}>
            {transferInFlight
              ? "Saving…"
              : mode === "create"
                ? "Create student"
                : "Save changes"}
          </Button>
        </div>
      </form>

      <Dialog
        open={transferConfirmOpen && !transferFailed}
        onOpenChange={(open) => {
          if (!open) {
            if (transferInFlight) return;
            setTransferConfirmOpen(false);
            setPendingFormData(null);
            setTransferSubmitting(false);
            transferSubmitLock.current = false;
          }
        }}
      >
        <DialogContent
          onPointerDownOutside={(e) => {
            if (transferInFlight) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (transferInFlight) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Transfer class placement?</DialogTitle>
            <DialogDescription>{transferConfirmCopy}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={transferInFlight}
              onClick={() => {
                if (transferInFlight) return;
                setTransferConfirmOpen(false);
                setPendingFormData(null);
                setTransferSubmitting(false);
                transferSubmitLock.current = false;
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={transferInFlight}
              onClick={confirmTransfer}
            >
              {transferInFlight ? "Transferring…" : "Confirm transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
