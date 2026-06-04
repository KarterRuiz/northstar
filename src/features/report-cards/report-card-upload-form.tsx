"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  uploadReportCardAction,
  type UploadReportCardState,
} from "@/features/report-cards/upload-report-card-action";
import { REPORT_CARD_TERMS } from "@/lib/report-cards/constants";

type UploadPhase = "idle" | "uploading";

function phaseLabel(phase: UploadPhase): string | null {
  if (phase === "uploading") {
    return "Uploading and saving (this can take a moment for larger PDFs)…";
  }
  return null;
}

type ReportCardUploadFormProps = {
  dashboardRole: Role;
  /** When set, pre-fills the student id field (e.g. from workspace context). */
  studentId?: string;
  /** Suggested school years for the picker; first entry is the default. */
  suggestedSchoolYears?: string[];
};

export function ReportCardUploadForm({
  dashboardRole,
  studentId,
  suggestedSchoolYears,
}: ReportCardUploadFormProps) {
  const router = useRouter();
  const [state, setState] = useState<UploadReportCardState | undefined>(
    undefined,
  );
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [isPending, startTransition] = useTransition();

  const schoolYears =
    suggestedSchoolYears && suggestedSchoolYears.length > 0
      ? suggestedSchoolYears
      : ["2025-2026"];
  const defaultSchoolYear = schoolYears[0]!;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload report card (PDF)</CardTitle>
        <CardDescription>
          Files go to the private <code className="text-foreground text-xs">report-cards</code>{" "}
          bucket. Each successful upload writes a database row and an audit event.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setState(undefined);
          setPhase("uploading");
          startTransition(async () => {
            const fd = new FormData(form);
            const res = await uploadReportCardAction(undefined, fd);
            setState(res);
            if (res.ok) {
              form.reset();
              if (studentId) {
                const el = form.querySelector<HTMLInputElement>("#studentId");
                if (el) el.value = studentId;
              }
              const sy = form.querySelector<HTMLSelectElement>("#schoolYear");
              if (sy) sy.value = defaultSchoolYear;
            }
            setPhase("idle");
            router.refresh();
          });
        }}
      >
        <input type="hidden" name="dashboardRole" value={dashboardRole} />
        <CardContent className="grid gap-4">
          {phase !== "idle" && phaseLabel(phase) ? (
            <p className="text-muted-foreground text-sm" role="status" aria-live="polite">
              {phaseLabel(phase)}
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
          <div className="space-y-2">
            <Label htmlFor="studentId">Student id (UUID)</Label>
            <Input
              id="studentId"
              name="studentId"
              required
              placeholder="uuid"
              defaultValue={studentId}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schoolYear">School year</Label>
            <select
              id="schoolYear"
              name="schoolYear"
              required
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              defaultValue={defaultSchoolYear}
            >
              {schoolYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="term">Term</Label>
            <select
              id="term"
              name="term"
              required
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {REPORT_CARD_TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input id="title" name="title" maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">PDF file</Label>
            <Input id="file" name="file" type="file" accept="application/pdf" required />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Working…" : "Upload"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
