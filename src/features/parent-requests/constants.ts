export const PARENT_REQUEST_STATUSES = [
  "received",
  "approved",
  "completed",
  "denied",
] as const;

export type ParentRequestStatus = (typeof PARENT_REQUEST_STATUSES)[number];

export function isParentRequestStatus(value: string): value is ParentRequestStatus {
  return (PARENT_REQUEST_STATUSES as readonly string[]).includes(value);
}

export const PARENT_REQUEST_DOCUMENT_TYPES = [
  { id: "transcript", label: "Transcript" },
  { id: "report_cards", label: "Report cards" },
  { id: "enrollment_verification", label: "Enrollment verification" },
  { id: "immunization_record", label: "Immunization record" },
  { id: "disciplinary_summary", label: "Disciplinary summary" },
  { id: "other", label: "Other (describe in notes)" },
] as const;

export type ParentRequestDocumentId =
  (typeof PARENT_REQUEST_DOCUMENT_TYPES)[number]["id"];

export const PARENT_REQUEST_DOCUMENT_IDS = new Set<string>(
  PARENT_REQUEST_DOCUMENT_TYPES.map((d) => d.id),
);

export function parentRequestStatusLabel(status: string): string {
  switch (status) {
    case "received":
      return "Received";
    case "approved":
      return "Approved";
    case "completed":
      return "Completed";
    case "denied":
      return "Denied";
    default:
      return status;
  }
}
