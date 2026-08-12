import type { FollowUpCategory, FollowUpStatus, FollowUpTab } from "./types";

export const FOLLOW_UP_PAGE_SIZE = 12;
export const FOLLOW_UP_COMPLETED_PAGE_SIZE = 20;
export const DERIVED_SIGNAL_CAP = 8;

export const FOLLOW_UP_CATEGORY_LABELS: Record<FollowUpCategory, string> = {
  students: "Students",
  staff: "Staff",
  families: "Families",
  records: "Records",
  classes: "Classes",
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  open: "Open",
  waiting: "Waiting",
  completed: "Completed",
};

export const FOLLOW_UP_TAB_LABELS: Record<FollowUpTab, string> = {
  "my-day": "My Day",
  upcoming: "Upcoming",
  waiting: "Waiting",
  completed: "Completed",
};

export const FOLLOW_UP_EMPTY = {
  "my-day": "You’re caught up. Nothing currently needs your follow-up.",
  upcoming: "Nothing scheduled yet.",
  waiting: "Nothing is waiting on someone else.",
  completed: "Completed follow-ups will appear here.",
} as const;

export const FOLLOW_UP_PARTIAL_LOAD =
  "Some follow-ups could not be loaded right now.";

/**
 * Assignment to other leadership users is intentionally deferred.
 * Records are owned by created_by_profile_id. Do not assign to teachers.
 */
export const FOLLOW_UP_ASSIGNMENT_FUTURE_WORK =
  "Ownership assignment to other leadership users is future work. Follow-ups are owned by the creator.";
