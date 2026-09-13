"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
import { WorkspaceToast, useWorkspaceToast } from "@/components/workspace/workspace-toast";

import { updateClassDetailsAction } from "./class-management-actions";
import {
  updateClassDetailsBodySchema,
  type UpdateClassDetailsInput,
} from "./class-management-schemas";
import type {
  ClassManagementClassRow,
  GradeLevelRow,
  SchoolYearRow,
} from "./load-class-management-data";

const SELECT_CLASS =
  "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function ClassEditDetailsDialog({
  klass,
  schoolYears,
  gradeLevels,
  open,
  onOpenChange,
}: {
  klass: ClassManagementClassRow;
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const [pending, startTransition] = useTransition();
  const [clientError, setClientError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  const [schoolYearId, setSchoolYearId] = useState(klass.school_year_id);
  const [gradeLevelId, setGradeLevelId] = useState(klass.grade_level_id);
  const [name, setName] = useState(klass.name);
  const [section, setSection] = useState(klass.section ?? "");

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSchoolYearId(klass.school_year_id);
      setGradeLevelId(klass.grade_level_id);
      setName(klass.name);
      setSection(klass.section ?? "");
      setClientError(null);
    }
    wasOpen.current = open;
  }, [open, klass]);

  const canSave = schoolYears.length > 0 && gradeLevels.length > 0;
  /** Any enrollment / academic history — matches DB immutability trigger. */
  const schoolYearLocked = !klass.deletable;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setClientError(null);

    const payload: UpdateClassDetailsInput = {
      classId: klass.id,
      schoolYearId,
      gradeLevelId,
      name,
      section,
    };

    const parsed = updateClassDetailsBodySchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setClientError(first?.message ?? "Check the form and try again.");
      return;
    }

    startTransition(async () => {
      const res = await updateClassDetailsAction(parsed.data);
      if (!res.ok) {
        showToast("error", res.error);
        return;
      }
      showToast("success", res.message ?? "Class details were saved.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Edit class details</DialogTitle>
            <DialogDescription>
              Update the class name, section, and grade level.
              {schoolYearLocked
                ? " School year is locked because this class has enrollment history."
                : " School year can be changed only before students are enrolled."}
            </DialogDescription>
          </DialogHeader>

          <WorkspaceToast toast={toast} />

          {clientError ? (
            <p className="text-destructive text-sm" role="alert">
              {clientError}
            </p>
          ) : null}

          {!canSave ? (
            <p className="text-muted-foreground text-sm">
              Add a school year and grade level in School settings before editing class details.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`ed-year-${klass.id}`}>School year</Label>
                  <select
                    id={`ed-year-${klass.id}`}
                    className={SELECT_CLASS}
                    value={schoolYearId}
                    onChange={(e) => setSchoolYearId(e.target.value)}
                    required
                    disabled={pending || schoolYearLocked}
                  >
                    {schoolYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.label}
                      </option>
                    ))}
                    {!schoolYears.some((y) => y.id === klass.school_year_id) ? (
                      <option value={klass.school_year_id}>{klass.schoolYearLabel}</option>
                    ) : null}
                  </select>
                  {schoolYearLocked ? (
                    <p className="text-muted-foreground text-xs">
                      Historical year assignment cannot be rewritten after enrollments exist.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ed-grade-${klass.id}`}>Grade level</Label>
                  <select
                    id={`ed-grade-${klass.id}`}
                    className={SELECT_CLASS}
                    value={gradeLevelId}
                    onChange={(e) => setGradeLevelId(e.target.value)}
                    required
                    disabled={pending}
                  >
                    {gradeLevels.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                        {g.code ? ` (${g.code})` : ""}
                      </option>
                    ))}
                    {/* Keep current grade selectable if it was archived after assignment. */}
                    {!gradeLevels.some((g) => g.id === klass.grade_level_id) ? (
                      <option value={klass.grade_level_id}>{klass.gradeLevelName}</option>
                    ) : null}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`ed-name-${klass.id}`}>Class name</Label>
                  <Input
                    id={`ed-name-${klass.id}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={200}
                    disabled={pending}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ed-section-${klass.id}`}>Section</Label>
                  <Input
                    id={`ed-section-${klass.id}`}
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    required
                    maxLength={80}
                    disabled={pending}
                    autoComplete="off"
                    placeholder="e.g. 6A"
                  />
                </div>
              </div>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !canSave}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
