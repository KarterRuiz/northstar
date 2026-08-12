import { todayIso } from "@/features/attendance/attendance-date-utils";

import type {
  FollowUpCategory,
  FollowUpCounts,
  FollowUpItem,
  FollowUpStatus,
  FollowUpTab,
} from "./types";
import { FOLLOW_UP_CATEGORIES, FOLLOW_UP_STATUSES, FOLLOW_UP_TABS } from "./types";

export function isFollowUpCategory(value: string): value is FollowUpCategory {
  return (FOLLOW_UP_CATEGORIES as readonly string[]).includes(value);
}

export function isFollowUpStatus(value: string): value is FollowUpStatus {
  return (FOLLOW_UP_STATUSES as readonly string[]).includes(value);
}

export function isFollowUpTab(value: string): value is FollowUpTab {
  return (FOLLOW_UP_TABS as readonly string[]).includes(value);
}

export function parseFollowUpTab(raw: string | undefined): FollowUpTab {
  if (raw && isFollowUpTab(raw)) return raw;
  return "my-day";
}

export function parseFollowUpCategoryFilter(
  raw: string | undefined,
): FollowUpCategory | "all" {
  if (!raw || raw === "all") return "all";
  if (isFollowUpCategory(raw)) return raw;
  return "all";
}

/**
 * Single source of truth for tab placement AND summary counts.
 * Waiting is its own view — pending work on someone else is not Today's job.
 */
export function bucketForItem(
  item: Pick<FollowUpItem, "kind" | "status" | "dueOn">,
  today: string,
): FollowUpTab {
  if (item.status === "completed") return "completed";
  if (item.status === "waiting") return "waiting";
  if (item.kind === "derived") return "my-day";
  if (!item.dueOn || item.dueOn <= today) return "my-day";
  return "upcoming";
}

/** @deprecated Use bucketForItem — kept for call sites that only pass manual fields. */
export function tabForManualItem(args: {
  status: FollowUpStatus;
  dueOn: string | null;
  today: string;
}): FollowUpTab {
  return bucketForItem(
    { kind: "manual", status: args.status, dueOn: args.dueOn },
    args.today,
  );
}

export function matchesCategoryFilter(
  item: Pick<FollowUpItem, "category">,
  filter: FollowUpCategory | "all",
): boolean {
  if (filter === "all") return true;
  return item.category === filter;
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calendarDaysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00.000Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

export function rescheduleDueOn(
  today: string,
  choice: "tomorrow" | "next_week",
): string {
  return choice === "tomorrow" ? addCalendarDays(today, 1) : addCalendarDays(today, 7);
}

export function canCompleteFollowUp(kind: FollowUpItem["kind"]): boolean {
  return kind === "manual";
}

export function canEditFollowUp(kind: FollowUpItem["kind"]): boolean {
  return kind === "manual";
}

/**
 * Report-card signal only when the workspace can honestly claim coverage.
 * No invented deadlines.
 */
export function shouldSurfaceReportCardFollowUp(args: {
  reportingStarted: boolean;
  coverageKnown: boolean;
  missingCount: number;
}): boolean {
  return (
    args.reportingStarted &&
    args.coverageKnown &&
    args.missingCount > 0
  );
}

/** Routine success stays quiet. */
export function shouldSurfaceMissingClass(submitted: boolean, totalStudents: number): boolean {
  return !submitted && totalStudents > 0;
}

export function todayForFollowUp(): string {
  return todayIso();
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatFollowUpDue(dueOn: string | null, today: string): string {
  if (!dueOn) return "No date";
  const delta = calendarDaysBetween(today, dueOn);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "1 day overdue";
  if (delta < 0) return `${-delta} days overdue`;
  if (delta < 7) {
    const [y, m, d] = dueOn.slice(0, 10).split("-").map(Number);
    const date = new Date(Date.UTC(y!, m! - 1, d!));
    return WEEKDAYS[date.getUTCDay()] ?? dueOn;
  }
  const [, m, d] = dueOn.slice(0, 10).split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

export function isFollowUpOverdue(dueOn: string | null, today: string): boolean {
  return Boolean(dueOn && dueOn < today);
}

export function relatedContextLabel(item: Pick<FollowUpItem, "related">): string | null {
  const r = item.related;
  return (
    r.studentLabel ||
    r.staffLabel ||
    r.classLabel ||
    r.parentRequestLabel ||
    null
  );
}

/** Counts every waiting item — manuals and live signals share the same status. */
export function countWaiting(items: Pick<FollowUpItem, "status">[]): number {
  return items.filter((i) => i.status === "waiting").length;
}

export function countFollowUpBuckets(
  items: Array<Pick<FollowUpItem, "kind" | "status" | "dueOn">>,
  today: string,
): FollowUpCounts {
  const counts: FollowUpCounts = { today: 0, upcoming: 0, waiting: 0 };
  for (const item of items) {
    const bucket = bucketForItem(item, today);
    if (bucket === "my-day") counts.today += 1;
    else if (bucket === "upcoming") counts.upcoming += 1;
    else if (bucket === "waiting") counts.waiting += 1;
  }
  return counts;
}

function myDayPriority(item: FollowUpItem, today: string): number {
  if (item.kind === "manual" && item.dueOn && item.dueOn < today) return 0;
  if (item.kind === "manual" && item.dueOn === today) return 1;
  if (item.kind === "derived") return 2;
  return 3;
}

export function compareFollowUpItems(
  a: FollowUpItem,
  b: FollowUpItem,
  today: string,
  tab: FollowUpTab,
): number {
  if (tab === "my-day") {
    const pa = myDayPriority(a, today);
    const pb = myDayPriority(b, today);
    if (pa !== pb) return pa - pb;
  }
  if (tab === "waiting") {
    return a.createdAt.localeCompare(b.createdAt);
  }
  const aDue = a.dueOn ?? "9999-12-31";
  const bDue = b.dueOn ?? "9999-12-31";
  if (aDue !== bDue) return aDue.localeCompare(bDue);
  return a.createdAt.localeCompare(b.createdAt);
}

export function buildFollowUpWorkspaceView(args: {
  items: FollowUpItem[];
  tab: FollowUpTab;
  category: FollowUpCategory | "all";
  page: number;
  pageSize: number;
  today: string;
}): {
  counts: FollowUpCounts;
  items: FollowUpItem[];
  total: number;
} {
  const filtered = args.items.filter((item) =>
    matchesCategoryFilter(item, args.category),
  );
  const counts = countFollowUpBuckets(filtered, args.today);
  const source = filtered.filter(
    (item) => bucketForItem(item, args.today) === args.tab,
  );
  const sorted = [...source].sort((a, b) =>
    compareFollowUpItems(a, b, args.today, args.tab),
  );
  const total = sorted.length;
  const start = (args.page - 1) * args.pageSize;
  return {
    counts,
    items: sorted.slice(start, start + args.pageSize),
    total,
  };
}

export function hasPartialFollowUpLoad(
  manualFailed: boolean,
  derivedFailedCount: number,
): boolean {
  return manualFailed || derivedFailedCount > 0;
}

export function prefillFromFollowUpItem(item: FollowUpItem) {
  return {
    title: item.title,
    category: item.category,
    studentId: item.related.studentId ?? undefined,
    studentLabel: item.related.studentLabel ?? undefined,
    staffMemberId: item.related.staffMemberId ?? undefined,
    staffLabel: item.related.staffLabel ?? undefined,
    classId: item.related.classId ?? undefined,
    classLabel: item.related.classLabel ?? undefined,
    parentRequestId: item.related.parentRequestId ?? undefined,
    parentRequestLabel: item.related.parentRequestLabel ?? undefined,
  };
}
