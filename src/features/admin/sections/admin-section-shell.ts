/**
 * Static copy for admin workspace section shells (no data fetching).
 */
export type AdminSectionShellProps = {
  title: string;
  description: string;
  emptyState: string;
};

const ADMIN_SECTIONS: Record<string, AdminSectionShellProps> = {
  students: {
    title: "Students",
    description:
      "Browse and manage student profiles, enrolment status, and household links.",
    emptyState: "Student directory and tools will appear here.",
  },
  classes: {
    title: "Classes",
    description:
      "Configure class rosters, schedules, and teaching assignments for the current term.",
    emptyState: "Class management views will appear here.",
  },
  teachers: {
    title: "Teachers",
    description:
      "Manage staff accounts, classroom assignments, and professional records access.",
    emptyState: "Teacher directory and assignments will appear here.",
  },
  "report-cards": {
    title: "Report cards",
    description:
      "Track report card cycles, publishing status, and parent visibility.",
    emptyState: "Report card workflows will appear here.",
  },
  "transition-notes": {
    title: "Transition notes",
    description:
      "Review and approve notes that accompany students moving between programmes or schools.",
    emptyState: "Transition note queues will appear here.",
  },
  "parent-requests": {
    title: "Parent requests",
    description:
      "Handle formal requests from parents and guardians for records, transcripts, or corrections.",
    emptyState: "Request inbox and processing tools will appear here.",
  },
};

export function getAdminSectionShellProps(
  segments: string[],
): AdminSectionShellProps | null {
  if (segments.length !== 1) return null;
  const key = segments[0];
  if (!key) return null;
  return ADMIN_SECTIONS[key] ?? null;
}
