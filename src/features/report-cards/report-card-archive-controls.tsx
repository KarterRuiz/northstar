"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  WorkspaceToast,
  useWorkspaceToast,
} from "@/components/workspace/workspace-toast";
import type { ReportReadinessStatus } from "@/features/teacher/gradebook/report-readiness";

import {
  generateAndArchiveReportCard,
  type GenerateAndArchiveReportCardState,
} from "./generate-and-archive-report-card-action";

type ReportCardArchiveControlsProps = {
  studentId: string;
  classId: string;
  schoolYear: string;
  term: string;
  /** @deprecated Snapshot cards always save; kept for call-site compatibility. */
  readinessStatus?: ReportReadinessStatus;
  /** @deprecated Server generates PDF; kept for call-site compatibility. */
  printTargetId?: string;
};

export function ReportCardArchiveControls({
  studentId,
  classId,
  schoolYear,
  term,
}: ReportCardArchiveControlsProps) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const lastHandled = React.useRef<GenerateAndArchiveReportCardState | undefined>(
    undefined,
  );

  const [archiveState, submitArchive, isArchiving] = useActionState<
    GenerateAndArchiveReportCardState | undefined,
    FormData
  >(generateAndArchiveReportCard, undefined);

  React.useEffect(() => {
    if (!archiveState || archiveState === lastHandled.current) return;
    lastHandled.current = archiveState;
    if (archiveState.ok) {
      showToast(
        "success",
        archiveState.message ?? "Report card saved to student record.",
      );
      router.refresh();
    } else {
      showToast("error", archiveState.message);
    }
  }, [archiveState, router, showToast]);

  function handleSaveToRecord() {
    if (isArchiving) return;

    const formData = new FormData();
    formData.set("dashboardRole", "teacher");
    formData.set("studentId", studentId);
    formData.set("classId", classId);
    formData.set("schoolYear", schoolYear);
    formData.set("term", term);

    submitArchive(formData);
  }

  return (
    <div className="space-y-3 print:hidden">
      <Button
        type="button"
        size="sm"
        disabled={isArchiving}
        onClick={handleSaveToRecord}
      >
        {isArchiving ? "Saving…" : "Save to student record"}
      </Button>
      <WorkspaceToast toast={toast} />
    </div>
  );
}
