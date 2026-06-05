"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceToast, useWorkspaceToast } from "@/components/workspace/workspace-toast";

import { createClassWithTeachersAction } from "./class-management-actions";
import {
  createClassWithTeachersBodySchema,
  type CreateClassWithTeachersInput,
} from "./class-management-schemas";
import {
  CLASS_TEACHER_UI_EXTRA_ROLE_KEYS,
  CLASS_TEACHER_UI_EXTRA_ROLE_LABELS,
  type ClassTeacherUiExtraRole,
} from "./constants";
import type { GradeLevelRow, SchoolYearRow, TeacherOption } from "./load-class-management-data";

const SELECT_CLASS =
  "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

type ExtraRow = { key: string; teacherProfileId: string; uiRole: ClassTeacherUiExtraRole };

function defaultExtraRow(): ExtraRow {
  return {
    key: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()),
    teacherProfileId: "",
    uiRole: "co_teacher",
  };
}

export function NewClassDialog({
  dashboardRole,
  schoolYears,
  gradeLevels,
  teachers,
}: {
  dashboardRole: Role;
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelRow[];
  teachers: TeacherOption[];
}) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [clientError, setClientError] = React.useState<string | null>(null);

  const canCreate = schoolYears.length > 0 && gradeLevels.length > 0 && teachers.length > 0;
  const settingsHref = `/dashboard/${dashboardRole}/school-settings#academic-structure`;

  const [schoolYearId, setSchoolYearId] = React.useState("");
  const [gradeLevelId, setGradeLevelId] = React.useState("");
  const [name, setName] = React.useState("");
  const [section, setSection] = React.useState("");
  const [homeroomTeacherProfileId, setHomeroomTeacherProfileId] = React.useState("");
  const [roomNumber, setRoomNumber] = React.useState("");
  const [capacity, setCapacity] = React.useState("");
  const [extraRows, setExtraRows] = React.useState<ExtraRow[]>([]);

  const resetFormForOpen = React.useCallback(() => {
    setSchoolYearId(schoolYears[0]?.id ?? "");
    setGradeLevelId(gradeLevels[0]?.id ?? "");
    setName("");
    setSection("");
    setHomeroomTeacherProfileId(teachers[0]?.id ?? "");
    setRoomNumber("");
    setCapacity("");
    setExtraRows([]);
    setClientError(null);
  }, [schoolYears, gradeLevels, teachers]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      resetFormForOpen();
    }
    setOpen(next);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    const payload: CreateClassWithTeachersInput = {
      schoolYearId,
      gradeLevelId,
      name,
      section,
      homeroomTeacherProfileId,
      additionalTeachers: extraRows
        .filter((r) => r.teacherProfileId.length > 0)
        .map((r) => ({
          teacherProfileId: r.teacherProfileId,
          uiRole: r.uiRole,
        })),
      roomNumber: roomNumber.trim() || undefined,
      capacity: capacity.trim() === "" ? undefined : Number.parseInt(capacity, 10),
    };

    const parsed = createClassWithTeachersBodySchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setClientError(first?.message ?? "Check the form and try again.");
      return;
    }

    startTransition(async () => {
      const res = await createClassWithTeachersAction(parsed.data);
      if (!res.ok) {
        showToast("error", res.error);
        return;
      }
      showToast("success", res.message ?? "Class created.");
      handleOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          disabled={!canCreate}
          className="gap-2 shadow-sm"
          title={
            !canCreate
              ? "Add school years, grade levels, and teacher accounts before creating a class."
              : undefined
          }
        >
          <Plus className="size-4" aria-hidden />
          + New class
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl gap-0 overflow-y-auto p-0 sm:rounded-xl">
        <form onSubmit={onSubmit} className="flex flex-col">
          <div className="border-border space-y-1 border-b px-6 py-5">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-xl font-semibold tracking-tight">New class</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                One step creates the class, homeroom, and supporting teachers. School years and
                grades are managed under{" "}
                <a href={settingsHref} className="text-primary font-medium underline-offset-4 hover:underline">
                  School settings → Academic structure
                </a>
                .
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-6 py-5">
            <WorkspaceToast toast={toast} />

            {!canCreate ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {schoolYears.length === 0 || gradeLevels.length === 0 ? (
                  <>
                    Add a school year and grade level in{" "}
                    <a
                      href={settingsHref}
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      School settings → Academic structure
                    </a>{" "}
                    first.
                  </>
                ) : (
                  <>No teacher profiles are available yet. Invite staff with the teacher role first.</>
                )}
              </p>
            ) : (
              <>
                {clientError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {clientError}
                  </p>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nc-year">School year</Label>
                    <select
                      id="nc-year"
                      className={SELECT_CLASS}
                      value={schoolYearId}
                      onChange={(e) => setSchoolYearId(e.target.value)}
                      required
                    >
                      {schoolYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nc-grade">Grade level</Label>
                    <select
                      id="nc-grade"
                      className={SELECT_CLASS}
                      value={gradeLevelId}
                      onChange={(e) => setGradeLevelId(e.target.value)}
                      required
                    >
                      {gradeLevels.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                          {g.code ? ` (${g.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nc-name">Class name</Label>
                    <Input
                      id="nc-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Homeroom"
                      autoComplete="off"
                      required
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nc-section">Section</Label>
                    <Input
                      id="nc-section"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. 6A"
                      autoComplete="off"
                      required
                      maxLength={80}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nc-homeroom">Homeroom teacher</Label>
                  <select
                    id="nc-homeroom"
                    className={SELECT_CLASS}
                    value={homeroomTeacherProfileId}
                    onChange={(e) => setHomeroomTeacherProfileId(e.target.value)}
                    required
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nc-room">Room number (optional)</Label>
                    <Input
                      id="nc-room"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="Not stored yet"
                      autoComplete="off"
                      maxLength={40}
                    />
                    <p className="text-muted-foreground text-xs">
                      Captured for future use — the database does not store room yet.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nc-capacity">Capacity (optional)</Label>
                    <Input
                      id="nc-capacity"
                      inputMode="numeric"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="e.g. 28"
                      autoComplete="off"
                    />
                    <p className="text-muted-foreground text-xs">
                      Captured for future use — not persisted without a schema change.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-foreground">Additional teachers</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setExtraRows((rows) => [...rows, defaultExtraRow()])}
                    >
                      Add row
                    </Button>
                  </div>
                  {extraRows.length === 0 ? (
                    <p className="text-muted-foreground text-sm">None — you can add co-teachers or specialists.</p>
                  ) : (
                    <ul className="space-y-3">
                      {extraRows.map((row, idx) => (
                        <li
                          key={row.key}
                          className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end"
                        >
                          <div className="min-w-0 flex-1 space-y-2">
                            <Label htmlFor={`nc-ex-${row.key}-t`} className="sr-only">
                              Teacher {idx + 1}
                            </Label>
                            <select
                              id={`nc-ex-${row.key}-t`}
                              className={SELECT_CLASS}
                              value={row.teacherProfileId}
                              onChange={(e) => {
                                const v = e.target.value;
                                setExtraRows((rows) =>
                                  rows.map((r) => (r.key === row.key ? { ...r, teacherProfileId: v } : r)),
                                );
                              }}
                              required
                            >
                              <option value="">Select teacher…</option>
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-full space-y-2 sm:w-44">
                            <Label htmlFor={`nc-ex-${row.key}-r`} className="sr-only">
                              Role {idx + 1}
                            </Label>
                            <select
                              id={`nc-ex-${row.key}-r`}
                              className={SELECT_CLASS}
                              value={row.uiRole}
                              onChange={(e) => {
                                const v = e.target.value as ClassTeacherUiExtraRole;
                                setExtraRows((rows) =>
                                  rows.map((r) => (r.key === row.key ? { ...r, uiRole: v } : r)),
                                );
                              }}
                            >
                              {CLASS_TEACHER_UI_EXTRA_ROLE_KEYS.map((k) => (
                                <option key={k} value={k}>
                                  {CLASS_TEACHER_UI_EXTRA_ROLE_LABELS[k]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground shrink-0"
                            onClick={() => setExtraRows((rows) => rows.filter((r) => r.key !== row.key))}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="bg-muted/30 border-border gap-2 border-t px-6 py-4 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !canCreate}>
              {pending ? "Creating…" : "Create class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
