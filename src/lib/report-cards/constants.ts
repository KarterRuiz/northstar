/** Private bucket; downloads use the signed-URL API route after auth checks. */
export const REPORT_CARDS_BUCKET = "report-cards";

/** ~10 MiB PDF cap (also enforced server-side). */
export const MAX_REPORT_CARD_BYTES = 10 * 1024 * 1024;

export const REPORT_CARD_TERMS = ["T1", "T2", "T3", "T4"] as const;

export type ReportCardTerm = (typeof REPORT_CARD_TERMS)[number];

export function isReportCardTerm(value: string): value is ReportCardTerm {
  return (REPORT_CARD_TERMS as readonly string[]).includes(value);
}
