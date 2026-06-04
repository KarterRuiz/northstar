/**
 * Static labels for admin overview cards (values come from Supabase in
 * `load-admin-dashboard-stats.ts`).
 */
export const ADMIN_SUMMARY_CARD_META = [
  {
    id: "total-students",
    title: "Total active students",
    caption: "Distinct students with at least one active enrollment",
  },
  {
    id: "active-classes",
    title: "Active classes",
    caption: "Classes marked active for scheduling",
  },
  {
    id: "pending-transition-notes",
    title: "Transition notes awaiting review",
    caption: "Teacher submissions in submitted status (not draft or archived)",
  },
  {
    id: "missing-report-cards",
    title: "Missing report cards",
    caption:
      "Active students without a report card PDF for the latest school year label",
  },
  {
    id: "recent-record-requests",
    title: "Received parent requests (30d)",
    caption:
      "Requests still in received status from the last 30 days (awaiting fulfilment)",
  },
] as const;
