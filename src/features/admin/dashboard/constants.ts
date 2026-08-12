/**
 * Quick Access destinations for Admin Home.
 * Summaries and status come from loaders; paths are role-prefixed at render time.
 */
export const ADMIN_QUICK_ACCESS_META = [
  {
    id: "students",
    title: "Students",
    path: "/students",
  },
  {
    id: "staff",
    title: "Staff",
    path: "/teachers",
  },
  {
    id: "attendance",
    title: "Attendance",
    path: "/attendance",
  },
  {
    id: "classes",
    title: "Classes",
    path: "/classes",
  },
  {
    id: "report-cards",
    title: "Report cards",
    path: "/report-cards",
  },
  {
    id: "follow-up",
    title: "Follow-Up",
    path: "/follow-up",
  },
  {
    id: "parent-requests",
    title: "Parent requests",
    path: "/parent-requests",
  },
  {
    id: "academic-review",
    title: "Academic review",
    path: "/academic-review",
  },
] as const;

export type AdminQuickAccessId = (typeof ADMIN_QUICK_ACCESS_META)[number]["id"];

/** @deprecated Prefer ADMIN_QUICK_ACCESS_META — kept for residual imports. */
export const ADMIN_HEALTH_CARD_META = [
  {
    id: "attendance",
    title: "Attendance",
    path: "/attendance",
    cta: "Open attendance",
  },
  {
    id: "students",
    title: "Students",
    path: "/students",
    cta: "View students",
  },
  {
    id: "classes",
    title: "Classes",
    path: "/classes",
    cta: "View classes",
  },
  {
    id: "transition-notes",
    title: "Transition notes",
    path: "/academic-review?tn=submitted",
    cta: "Review notes",
  },
  {
    id: "report-cards",
    title: "Report cards",
    path: "/report-cards",
    cta: "Open report cards",
  },
  {
    id: "parent-requests",
    title: "Parent requests",
    path: "/parent-requests",
    cta: "Open inbox",
  },
] as const;

/** @deprecated Prefer ADMIN_QUICK_ACCESS_META. */
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

/** @deprecated Prefer Quick Access workspace cards. */
export type AdminQuickActionId =
  | "add-student"
  | "add-staff"
  | "create-class"
  | "send-invitations"
  | "open-attendance"
  | "review-transition-notes"
  | "open-report-cards";

/** @deprecated Prefer ADMIN_QUICK_ACCESS_META. */
export const ADMIN_QUICK_ACTIONS: {
  id: AdminQuickActionId;
  label: string;
  path: string;
  primary?: boolean;
}[] = [
  { id: "add-student", label: "Add student", path: "/students/new", primary: true },
  { id: "add-staff", label: "Add staff", path: "/teachers" },
  { id: "create-class", label: "Create class", path: "/classes" },
  { id: "send-invitations", label: "Send staff invitations", path: "/teachers" },
  { id: "open-attendance", label: "Open attendance", path: "/attendance" },
  {
    id: "review-transition-notes",
    label: "Review transition notes",
    path: "/academic-review?tn=submitted",
  },
  { id: "open-report-cards", label: "Open report cards", path: "/report-cards" },
];
