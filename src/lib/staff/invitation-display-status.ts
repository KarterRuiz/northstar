import type { Database } from "@/types/database.types";

type InvitationStatus = Database["public"]["Tables"]["staff_invitations"]["Row"]["status"];

export type StaffInvitationDisplayStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "cancelled"
  | "inactive";

export function staffInvitationDisplayStatus(row: {
  status: InvitationStatus;
  expires_at?: string | null;
}): StaffInvitationDisplayStatus {
  if (row.status === "accepted") return "accepted";
  if (row.status === "cancelled") return "cancelled";
  if (row.status === "expired") return "expired";
  if (row.expires_at) {
    const ex = new Date(row.expires_at).getTime();
    if (!Number.isNaN(ex) && ex < Date.now()) return "expired";
  }
  if (row.status === "pending") return "pending";
  return "inactive";
}

export function staffInvitationStatusLabel(
  s: StaffInvitationDisplayStatus,
): string {
  switch (s) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Withdrawn";
    case "inactive":
      return "Inactive";
    default:
      return s;
  }
}
