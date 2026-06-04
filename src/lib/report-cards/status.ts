import type { Database } from "@/types/database.types";

export type ReportCardFileStatus =
  Database["public"]["Tables"]["report_card_files"]["Row"]["status"];

export const REPORT_CARD_FILE_STATUSES: readonly ReportCardFileStatus[] = [
  "draft",
  "final",
  "archive",
] as const;

export function isReportCardFileStatus(
  value: string,
): value is ReportCardFileStatus {
  return (REPORT_CARD_FILE_STATUSES as readonly string[]).includes(value);
}

export const reportCardStatusLabel: Record<ReportCardFileStatus, string> = {
  draft: "Draft",
  final: "Final",
  archive: "Archived",
};
