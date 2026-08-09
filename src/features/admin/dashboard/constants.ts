/**
 * Static labels and destinations for admin operational signal cards.
 * Values and status come from `load-admin-dashboard-stats.ts`.
 */
export const ADMIN_SIGNAL_CARD_META = [
  {
    id: "student-enrollment",
    title: "Student enrollment",
    href: "/dashboard/admin/students",
    cta: "View students",
  },
  {
    id: "active-classes",
    title: "Active classes",
    href: "/dashboard/admin/classes",
    cta: "View classes",
  },
  {
    id: "transition-notes",
    title: "Transition notes",
    href: "/dashboard/admin/academic-review?tn=submitted",
    cta: "Review notes",
  },
  {
    id: "report-cards",
    title: "Report cards",
    href: "/dashboard/admin/report-cards",
    cta: "Open report cards",
  },
  {
    id: "parent-requests",
    title: "Parent requests",
    href: "/dashboard/admin/parent-requests",
    cta: "Open requests",
  },
] as const;
