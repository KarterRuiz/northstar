import type { SupportFlag, SupportFlagKind } from "./support-flags";

/** Grade below this percent triggers academic risk (rules-only, no AI). */
export const ACADEMIC_RISK_GRADE_THRESHOLD = 70;

/** Missing assignment count above this triggers missing-work alert. */
export const MISSING_WORK_ALERT_THRESHOLD = 2;

/** Grade at or above this with no missing work flags enrichment candidate. */
export const ENRICHMENT_GRADE_THRESHOLD = 90;

export type AcademicFlagKind = Extract<
  SupportFlagKind,
  "academic_risk" | "missing_work" | "enrichment_candidate"
>;

export type AcademicFlag = SupportFlag;

export function computeAcademicFlags(args: {
  overallPercent: number | null;
  missingAssignmentCount: number;
}): AcademicFlag[] {
  const flags: AcademicFlag[] = [];
  const { overallPercent, missingAssignmentCount } = args;

  if (
    overallPercent !== null &&
    overallPercent < ACADEMIC_RISK_GRADE_THRESHOLD
  ) {
    flags.push({
      kind: "academic_risk",
      label: "Academic risk",
    });
  }

  if (missingAssignmentCount > MISSING_WORK_ALERT_THRESHOLD) {
    flags.push({
      kind: "missing_work",
      label: "Missing work",
    });
  }

  if (
    overallPercent !== null &&
    overallPercent >= ENRICHMENT_GRADE_THRESHOLD &&
    missingAssignmentCount === 0
  ) {
    flags.push({
      kind: "enrichment_candidate",
      label: "Enrichment ready",
    });
  }

  return flags;
}

/** Dashboard missing-work column: "0", "1 assignment", or "N assignments". */
export function formatMissingWorkCount(count: number): string {
  if (count === 0) return "0";
  return count === 1 ? "1 assignment" : `${count} assignments`;
}

export function hasAcademicRisk(flags: AcademicFlag[]): boolean {
  return flags.some((f) => f.kind === "academic_risk");
}

export function hasMissingWorkAlert(flags: AcademicFlag[]): boolean {
  return flags.some((f) => f.kind === "missing_work");
}

export function hasEnrichmentCandidate(flags: AcademicFlag[]): boolean {
  return flags.some((f) => f.kind === "enrichment_candidate");
}
