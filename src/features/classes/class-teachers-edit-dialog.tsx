"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceToast, useWorkspaceToast } from "@/components/workspace/workspace-toast";

import { saveClassTeachersAction } from "./class-management-actions";
import {
  CLASS_TEACHER_ROLE_HOMEROOM,
  CLASS_TEACHER_UI_EXTRA_ROLE_KEYS,
  CLASS_TEACHER_UI_EXTRA_ROLE_LABELS,
  type ClassTeacherUiExtraRole,
  dbExtraRoleToUiRole,
} from "./constants";
import type { ClassManagementClassRow, TeacherOption } from "./load-class-management-data";

type AdditionalLine = {
  key: string;
  teacherProfileId: string;
  uiRole: ClassTeacherUiExtraRole;
};

function newLine(): AdditionalLine {
  return {
    key:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Math.random()),
    teacherProfileId: "",
    uiRole: "co_teacher",
  };
}

function buildInitialForm(klass: ClassManagementClassRow): {
  homeroomId: string;
  lines: AdditionalLine[];
} {
  const homeroom = klass.teachers.find((t) => t.role === CLASS_TEACHER_ROLE_HOMEROOM);
  const lines: AdditionalLine[] = klass.teachers
    .filter((t) => t.role !== CLASS_TEACHER_ROLE_HOMEROOM)
    .map((t) => ({
      key: t.id,
      teacherProfileId: t.teacherProfileId,
      uiRole: dbExtraRoleToUiRole(t.role),
    }));
  return {
    homeroomId: homeroom?.teacherProfileId ?? "",
    lines,
  };
}

export function ClassTeachersEditDialog({
  klass,
  teachers,
  disabled,
  disabledReason,
}: {
  klass: ClassManagementClassRow;
  teachers: TeacherOption[];
  disabled: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const [open, setOpen] = useState(false);
  const [homeroomId, setHomeroomId] = useState("");
  const [lines, setLines] = useState<AdditionalLine[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const init = buildInitialForm(klass);
      setHomeroomId(init.homeroomId);
      setLines(init.lines.length > 0 ? init.lines : []);
      setClientError(null);
      setServerError(null);
    }
    wasOpen.current = open;
  }, [open, klass]);

  const homeroomSelectValue = homeroomId.length > 0 ? homeroomId : "__none__";

  const optionsForRow = useMemo(() => {
    return (rowKey: string) => {
      const selfId = lines.find((l) => l.key === rowKey)?.teacherProfileId ?? "";
      const otherSelected = new Set(
        lines.filter((l) => l.key !== rowKey).map((l) => l.teacherProfileId).filter(Boolean),
      );
      return teachers.filter((t) => {
        if (homeroomId && t.id === homeroomId) return false;
        if (otherSelected.has(t.id) && t.id !== selfId) return false;
        return true;
      });
    };
  }, [lines, teachers, homeroomId]);

  function validate(): string | null {
    for (const line of lines) {
      if (!line.teacherProfileId) {
        return "Choose a teacher for each additional teacher row, or remove empty rows.";
      }
    }
    const ids = lines.map((l) => l.teacherProfileId).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      return "Each teacher can only appear once in additional teachers.";
    }
    if (homeroomId && ids.includes(homeroomId)) {
      return "Remove the homeroom teacher from additional teachers.";
    }
    return null;
  }

  function submitForm(form: HTMLFormElement) {
    const err = validate();
    if (err) {
      setClientError(err);
      return;
    }
    setClientError(null);
    setServerError(null);

    const fd = new FormData(form);
    const additionalPayload = lines
      .filter((l) => l.teacherProfileId)
      .map((l) => ({ teacherProfileId: l.teacherProfileId, uiRole: l.uiRole }));
    fd.set("additionalTeachers", JSON.stringify(additionalPayload));

    startTransition(() => {
      void (async () => {
        const res = await saveClassTeachersAction(undefined, fd);
        if (res.ok) {
          showToast("success", res.message ?? "Class teachers were saved.");
          setOpen(false);
          router.refresh();
        } else {
          setServerError(res.error);
          showToast("error", res.error);
        }
      })();
    });
  }

  const classHeading = klass.name.trim() || "Class";

  return (
    <>
      <span title={disabled ? disabledReason : undefined}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          Edit teachers
        </Button>
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit teachers</DialogTitle>
            <DialogDescription>
              Homeroom and supporting teachers are stored in{" "}
              <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">class_teachers</code>{" "}
              (one row per teacher per class).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 pb-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Class</p>
            <p className="text-foreground text-base font-semibold">{classHeading}</p>
          </div>

          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              submitForm(e.currentTarget);
            }}
          >
            <input type="hidden" name="classId" value={klass.id} />

            <div className="space-y-2">
              <Label htmlFor={`hr-${klass.id}`}>Homeroom teacher</Label>
              <select
                id={`hr-${klass.id}`}
                name="homeroomTeacherProfileId"
                value={homeroomSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setHomeroomId(v === "__none__" ? "" : v);
                }}
                disabled={pending || teachers.length === 0}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="__none__">Unassigned</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Additional teachers</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                >
                  Add teacher
                </Button>
              </div>

              {lines.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No additional teachers. Use Add teacher to include co-teachers, subject teachers, and
                  assistants.
                </p>
              ) : (
                <ScrollArea className="max-h-60 pr-3">
                  <ul className="space-y-4">
                    {lines.map((line) => (
                      <li
                        key={line.key}
                        className="border-muted/80 bg-muted/20 space-y-2 rounded-md border p-3"
                      >
                        <div className="flex flex-wrap items-end justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-2">
                            <Label className="text-xs">Teacher</Label>
                            <select
                              value={line.teacherProfileId}
                              onChange={(e) => {
                                const v = e.target.value;
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key ? { ...l, teacherProfileId: v } : l,
                                  ),
                                );
                              }}
                              disabled={pending}
                              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                            >
                              <option value="">Select teacher…</option>
                              {optionsForRow(line.key).map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-destructive hover:text-destructive"
                            disabled={pending}
                            onClick={() =>
                              setLines((prev) => prev.filter((l) => l.key !== line.key))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Role type</Label>
                          <select
                            value={line.uiRole}
                            onChange={(e) => {
                              const v = e.target.value as ClassTeacherUiExtraRole;
                              if (!(CLASS_TEACHER_UI_EXTRA_ROLE_KEYS as readonly string[]).includes(v)) {
                                return;
                              }
                              setLines((prev) =>
                                prev.map((l) => (l.key === line.key ? { ...l, uiRole: v } : l)),
                              );
                            }}
                            disabled={pending}
                            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                          >
                            {CLASS_TEACHER_UI_EXTRA_ROLE_KEYS.map((k) => (
                              <option key={k} value={k}>
                                {CLASS_TEACHER_UI_EXTRA_ROLE_LABELS[k]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>

            {clientError ? (
              <p className="text-destructive text-sm" role="alert">
                {clientError}
              </p>
            ) : null}
            {serverError ? (
              <p className="text-destructive text-sm" role="alert">
                {serverError}
              </p>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || teachers.length === 0}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>

          <WorkspaceToast toast={toast} />
        </DialogContent>
      </Dialog>
    </>
  );
}
