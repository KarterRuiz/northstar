import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/badge";

/**
 * Shared operational signal status language for Admin Overview.
 * Use one of these labels consistently across signal cards.
 * Colors come from design-system semantic tokens — not page-local palettes.
 */
export const ADMIN_SIGNAL_STATUSES = [
  "Healthy",
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
    case "Healthy":
    case "On track":
      return "success";
    case "Needs attention":
      return "warning";
    case "Action needed":
      return "destructive";
    case "Not started":
      return "muted";
  }
}

export function enrollmentSignalStatus(count: number): AdminSignalStatus {
  return count > 0 ? "Healthy" : "Needs attention";
}

export function classesSignalStatus(count: number): AdminSignalStatus {
  return count > 0 ? "Healthy" : "Needs attention";
}

export function queueSignalStatus(count: number): AdminSignalStatus {
  if (count === 0) return "Healthy";
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
}): AdminSignalStatus {
  if (args.classesNotSubmitted === 0 && args.studentsNeedingFollowUp === 0) {
    return "Healthy";
  }
  if (args.classesNotSubmitted >= 5 || args.studentsNeedingFollowUp >= 10) {
    return "Action needed";
  }
  return "Needs attention";
}
