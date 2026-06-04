"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { buildAttendanceConcern } from "@/features/attendance/attendance-concerns";
import {
  getAttendanceRiskTier,
  type AttendanceRiskTier,
} from "@/features/attendance/attendance-risk-tier";
import { CreateInterventionSheet } from "@/features/interventions/create-intervention-sheet";
import {
  useWorkspaceToast,
  WorkspaceToast,
} from "@/components/workspace/workspace-toast";

type AttendanceInterventionActionProps = {
  studentId: string;
  classId: string;
  studentName: string;
  termAbsences: number;
  termTardies: number;
  weeklyAbsences?: number;
  /** When set, show only for chronic tier; otherwise derived from stats. */
  riskTier?: AttendanceRiskTier;
};

export function AttendanceInterventionAction({
  studentId,
  classId,
  studentName,
  termAbsences,
  termTardies,
  weeklyAbsences,
  riskTier: riskTierProp,
}: AttendanceInterventionActionProps) {
  const [open, setOpen] = React.useState(false);
  const { toast, showToast } = useWorkspaceToast();

  const tier =
    riskTierProp ??
    getAttendanceRiskTier({
      termAbsences,
      termTardies,
      weeklyAbsences: weeklyAbsences ?? 0,
    });
  if (tier !== "chronic_concern") return null;

  const concern = buildAttendanceConcern({
    termAbsences,
    termTardies,
    weeklyAbsences: weeklyAbsences ?? 0,
  });

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Create attendance intervention
      </Button>
      <CreateInterventionSheet
        open={open}
        onOpenChange={setOpen}
        studentId={studentId}
        classId={classId}
        studentName={studentName}
        initialForm={
          concern
            ? {
                interventionType: "attendance",
                severity: concern.interventionSeverity,
                title: concern.interventionTitle,
                description: concern.interventionDescription,
                status: "active",
              }
            : {
                interventionType: "attendance",
                severity: "medium",
                title: "Attendance check-in",
                status: "active",
              }
        }
        onCreated={() => {
          showToast("success", "Attendance intervention created");
          setOpen(false);
        }}
      />
      <WorkspaceToast toast={toast} />
    </>
  );
}
