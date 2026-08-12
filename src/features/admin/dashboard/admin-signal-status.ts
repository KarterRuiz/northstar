import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/badge";
import type { StatusKind } from "@/components/ui/status-badge";

/**
 * Shared status language for Admin Home pulse / summaries.
 * Prefer honest labels — never claim "Healthy" for a mere headcount.
 * Colors come from design-system semantic tokens — not page-local palettes.
 */
export const ADMIN_SIGNAL_STATUSES = [
  "Clear",
  "Active",
  "On track",
  "Needs attention",
  "Action needed",
  "Not started",
] as const;

export type AdminSignalStatus = (typeof ADMIN_SIGNAL_STATUSES)[number];

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Prefer Badge `variant={adminSignalBadgeVariant(status)}` over ad-hoc color classes. */
export function adminSignalBadgeVariant(status: AdminSignalStatus): BadgeVariant {
  switch (status) {
    case "Clear":
    case "On track":
    case "Active":
      return "success";
    case "Needs attention":
      return "warning";
    case "Action needed":
      return "destructive";
    case "Not started":
      return "muted";
  }
}

export function adminSignalStatusKind(status: AdminSignalStatus): StatusKind {
  switch (status) {
    case "Clear":
    case "On track":
    case "Active":
      return "active";
    case "Needs attention":
      return "needs_attention";
    case "Action needed":
      return "expired";
    case "Not started":
      return "not_started";
  }
}

export function enrollmentSignalStatus(count: number): AdminSignalStatus {
  return count > 0 ? "Active" : "Needs attention";
}

export function classesSignalStatus(count: number): AdminSignalStatus {
  return count > 0 ? "Active" : "Needs attention";
}

export function queueSignalStatus(count: number): AdminSignalStatus {
  if (count === 0) return "Clear";
  if (count >= 10) return "Action needed";
  return "Needs attention";
}

export function reportCardSignalStatus(args: {
  reportingStarted: boolean;
  missingCount: number;
  /** When false, coverage could not be verified — never claim On track. */
  coverageKnown?: boolean;
}): AdminSignalStatus {
  if (!args.reportingStarted) return "Not started";
  if (args.coverageKnown === false) return "Needs attention";
  if (args.missingCount === 0) return "On track";
  if (args.missingCount >= 10) return "Action needed";
  return "Needs attention";
}

export function attendanceSignalStatus(args: {
  classesNotSubmitted: number;
  studentsNeedingFollowUp: number;
  hasClassesExpectingAttendance?: boolean;
}): AdminSignalStatus {
  if (args.hasClassesExpectingAttendance === false) {
    return "Not started";
  }
  if (args.classesNotSubmitted === 0 && args.studentsNeedingFollowUp === 0) {
    return "Clear";
  }
  if (args.classesNotSubmitted >= 5 || args.studentsNeedingFollowUp >= 10) {
    return "Action needed";
  }
  return "Needs attention";
}

export function staffOpsSignalStatus(args: {
  activeStaff: number;
  pendingInvitations: number;
  readyToInvite: number;
  teachersWithMissingAttendance: number;
}): AdminSignalStatus {
  if (args.teachersWithMissingAttendance > 0) {
    return args.teachersWithMissingAttendance >= 5
      ? "Action needed"
      : "Needs attention";
  }
  if (args.pendingInvitations > 0 || args.readyToInvite > 0) {
    return "Needs attention";
  }
  return args.activeStaff > 0 ? "Active" : "Not started";
}
