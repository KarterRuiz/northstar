export const FOLLOW_UP_CATEGORIES = [
  "students",
  "staff",
  "families",
  "records",
  "classes",
] as const;

export type FollowUpCategory = (typeof FOLLOW_UP_CATEGORIES)[number];

export const FOLLOW_UP_STATUSES = ["open", "waiting", "completed"] as const;

export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const FOLLOW_UP_TABS = ["my-day", "upcoming", "waiting", "completed"] as const;

export type FollowUpTab = (typeof FOLLOW_UP_TABS)[number];

export const FOLLOW_UP_KIND = {
  manual: "manual",
  derived: "derived",
} as const;

export type FollowUpKind = (typeof FOLLOW_UP_KIND)[keyof typeof FOLLOW_UP_KIND];

export const DERIVED_SOURCE_TYPES = [
  "attendance_missing_class",
  "attendance_student",
  "staff_pending_invite",
  "staff_draft_missing_email",
  "parent_request_open",
  "report_cards_missing",
  "transition_note_submitted",
] as const;

export type DerivedSourceType = (typeof DERIVED_SOURCE_TYPES)[number];

export type FollowUpRelated = {
  studentId: string | null;
  studentLabel: string | null;
  staffMemberId: string | null;
  staffLabel: string | null;
  classId: string | null;
  classLabel: string | null;
  parentRequestId: string | null;
  parentRequestLabel: string | null;
  transitionNoteId: string | null;
};

export type FollowUpItem = {
  id: string;
  kind: FollowUpKind;
  title: string;
  note: string | null;
  category: FollowUpCategory;
  status: FollowUpStatus;
  dueOn: string | null;
  ownerLabel: string | null;
  href: string | null;
  sourceType: string;
  sourceId: string | null;
  createdAt: string;
  completedAt: string | null;
  related: FollowUpRelated;
};

export type FollowUpPrefill = {
  studentId?: string;
  studentLabel?: string;
  staffMemberId?: string;
  staffLabel?: string;
  classId?: string;
  classLabel?: string;
  parentRequestId?: string;
  parentRequestLabel?: string;
  category?: FollowUpCategory;
  title?: string;
  dueOn?: string;
};

export type FollowUpCounts = {
  today: number;
  upcoming: number;
  waiting: number;
};
