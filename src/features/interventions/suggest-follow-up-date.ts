import type { InterventionSeverity, InterventionType } from "./schema";
import { addSchoolDays, startOfLocalDay, toIsoDateString } from "./school-days";

const TYPE_SCHOOL_DAYS: Partial<Record<InterventionType, number>> = {
  enrichment: 10,
  parent_contact: 3,
  missing_work: 5,
};

const SEVERITY_SCHOOL_DAYS: Record<InterventionSeverity, number> = {
  high: 3,
  medium: 5,
  low: 10,
};

export type SuggestFollowUpDateInput = {
  severity: InterventionSeverity;
  interventionType: InterventionType;
  /** Anchor date; defaults to today (local). */
  from?: Date;
};

/**
 * Research-informed follow-up offsets in school days (Mon–Fri).
 * Precedence: intervention type overrides severity when the type has a configured offset;
 * otherwise severity-based rules apply.
 */
export function suggestFollowUpDate({
  severity,
  interventionType,
  from = new Date(),
}: SuggestFollowUpDateInput): string {
  const schoolDays =
    TYPE_SCHOOL_DAYS[interventionType] ?? SEVERITY_SCHOOL_DAYS[severity];
  return toIsoDateString(addSchoolDays(startOfLocalDay(from), schoolDays));
}
