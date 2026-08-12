"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkExistingReportCardAction } from "@/features/report-cards/check-existing-report-card-action";
import {
  ReportCardStudentSelector,
  type SelectedReportCardStudent,
} from "@/features/report-cards/report-card-student-selector";
import {
  uploadReportCardAction,
  type ExistingReportCardWarning,
  type UploadReportCardState,
} from "@/features/report-cards/upload-report-card-action";
import { REPORT_CARD_TERMS } from "@/lib/report-cards/constants";
import { reportCardStatusLabel } from "@/lib/report-cards/status";

type UploadPhase = "idle" | "uploading";

type ReportCardUploadFormProps = {
  dashboardRole: Role;
  studentId?: string;
  studentLabel?: string;
  studentMeta?: string;
  suggestedSchoolYears?: string[];
  defaultTerm?: string;
  onSuccess?: () => void;
};

export function ReportCardUploadForm({
  dashboardRole,
  studentId,
  studentLabel,
  studentMeta,
  suggestedSchoolYears,
  defaultTerm,
  onSuccess,
}: ReportCardUploadFormProps) {
  const router = useRouter();
  const [state, setState] = useState<UploadReportCardState | undefined>(
    undefined,
  );
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<SelectedReportCardStudent | null>(
    studentId
      ? {
          id: studentId,
          name: studentLabel?.trim() || "Selected student",
          classLabel: studentMeta ?? null,
          gradeLabel: null,
          studentNumber: null,
        }
      : null,
  );
  const [schoolYear, setSchoolYear] = useState(
    suggestedSchoolYears?.[0] ?? "",
  );
  const [term, setTerm] = useState(
    defaultTerm && REPORT_CARD_TERMS.includes(defaultTerm as (typeof REPORT_CARD_TERMS)[number])
      ? defaultTerm
      : REPORT_CARD_TERMS[0],
  );
  const [existing, setExisting] = useState<ExistingReportCardWarning | null>(
    null,
  );
  const [existingKey, setExistingKey] = useState("");
  const [replaceKey, setReplaceKey] = useState<string | null>(null);

  const schoolYears =
    suggestedSchoolYears && suggestedSchoolYears.length > 0
      ? suggestedSchoolYears
      : [];

  const checkKey = `${selected?.id ?? ""}:${schoolYear}:${term}`;
  const shownExisting = existing && existingKey === checkKey ? existing : null;
  const replaceExisting = replaceKey === checkKey;

  useEffect(() => {
    if (!selected?.id || !schoolYear || !term) {
      return;
    }
    const key = `${selected.id}:${schoolYear}:${term}`;
    let cancelled = false;
    void checkExistingReportCardAction({
      studentId: selected.id,
      schoolYear,
      term,
    }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setExisting(res.existing);
        setExistingKey(key);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, schoolYear, term]);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (!selected?.id) return;
        setState(undefined);
        setPhase("uploading");
        startTransition(async () => {
          const fd = new FormData(form);
          fd.set("studentId", selected.id);
          fd.set("replaceExisting", replaceExisting ? "1" : "0");
          const res = await uploadReportCardAction(undefined, fd);
          setState(res);
          if (!res.ok && res.existing) {
            setExisting(res.existing);
            setExistingKey(`${selected.id}:${schoolYear}:${term}`);
          }
          if (res.ok) {
            form.reset();
            if (!studentId) setSelected(null);
            setReplaceKey(null);
            setExisting(null);
            setExistingKey("");
            onSuccess?.();
          }
          setPhase("idle");
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="dashboardRole" value={dashboardRole} />
      <input type="hidden" name="schoolYear" value={schoolYear} />
      <input type="hidden" name="term" value={term} />

      {phase === "uploading" ? (
        <p className="ns-muted" role="status" aria-live="polite">
          Uploading the PDF…
        </p>
      ) : null}
      {state && !state.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-primary" role="status">
          {state.message ?? "Uploaded."}
        </p>
      ) : null}

      {studentId ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">Student</p>
          <p className="text-heading text-sm font-medium">
            {studentLabel?.trim() || "Selected student"}
          </p>
          {studentMeta ? <p className="ns-meta">{studentMeta}</p> : null}
        </div>
      ) : (
        <ReportCardStudentSelector
          selected={selected}
          onSelect={setSelected}
          disabled={isPending}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="schoolYear">School year</Label>
          <select
            id="schoolYear"
            required
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {schoolYears.length === 0 ? (
              <option value="">No school years configured</option>
            ) : (
              schoolYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="term">Term</Label>
          <select
            id="term"
            required
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {REPORT_CARD_TERMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {shownExisting ? (
        <div
          className="border-border bg-surface-muted rounded-lg border px-3 py-2.5"
          role="status"
        >
          <p className="text-sm font-medium">
            A {reportCardStatusLabel[shownExisting.status].toLowerCase()} report
            already exists
            {shownExisting.title ? ` (${shownExisting.title})` : ""}.
          </p>
          <p className="ns-muted mt-1">
            Replacing archives the current file and uploads this PDF in its place.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) =>
                setReplaceKey(e.target.checked ? checkKey : null)
              }
            />
            Replace the existing report card
          </label>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input id="title" name="title" maxLength={200} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="file">PDF file</Label>
        <Input id="file" name="file" type="file" accept="application/pdf" required />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={
            isPending ||
            !selected?.id ||
            !schoolYear ||
            Boolean(shownExisting && !replaceExisting)
          }
        >
          {isPending
            ? "Working…"
            : shownExisting
              ? "Replace report card"
              : "Upload report card"}
        </Button>
      </div>
    </form>
  );
}
