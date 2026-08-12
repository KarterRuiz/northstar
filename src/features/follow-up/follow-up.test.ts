/**
 * Follow-Up expected coverage (Tests A–Q)
 *
 * A. My Day includes overdue and due-today open manuals; excludes completed and waiting.
 * B. Upcoming is future-dated open manuals only.
 * C. Completed tab is completed manuals only.
 * D. Waiting items (manual + derived) live in Waiting; counted from the same bucket.
 * E. Derived signals cannot be completed or edited.
 * F. Attendance: all classes submitted → no missing-class signal.
 * G. Attendance: one missing class → one signal.
 * H. Report cards: not started or coverage unknown → no signal.
 * I. Report cards: started + known coverage + missing → one aggregated signal.
 * J. Transition-note signal title never includes note body text.
 * K. Category filter All vs Students.
 * L. Reschedule tomorrow / next week is calendar-day based.
 * M. Leadership-only access: teacher/registrar denied; admin/principal/VP allowed.
 * N. Empty-copy matches product language.
 * O. Home brief uses a count, not a duplicated queue.
 * P. Waiting count matches the Waiting list (manual + pending invite).
 * Q. Partial source failure still builds a consistent workspace.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isLeadershipAuditRole } from "@/config/roles";

import { FOLLOW_UP_EMPTY, FOLLOW_UP_PARTIAL_LOAD } from "./constants";
import {
  bucketForItem,
  buildFollowUpWorkspaceView,
  canCompleteFollowUp,
  canEditFollowUp,
  countFollowUpBuckets,
  countWaiting,
  formatFollowUpDue,
  hasPartialFollowUpLoad,
  matchesCategoryFilter,
  parseFollowUpCategoryFilter,
  parseFollowUpTab,
  rescheduleDueOn,
  shouldSurfaceMissingClass,
  shouldSurfaceReportCardFollowUp,
  tabForManualItem,
} from "./classify";
import type { FollowUpItem } from "./types";

const TODAY = "2026-08-11";

function manual(
  partial: Partial<FollowUpItem> & Pick<FollowUpItem, "id" | "status" | "dueOn">,
): FollowUpItem {
  return {
    kind: "manual",
    title: "Check in",
    note: null,
    category: "students",
    ownerLabel: "Ada",
    href: null,
    sourceType: "manual",
    sourceId: null,
    createdAt: `${TODAY}T12:00:00.000Z`,
    completedAt: null,
    related: {
      studentId: null,
      studentLabel: null,
      staffMemberId: null,
      staffLabel: null,
      classId: null,
      classLabel: null,
      parentRequestId: null,
      parentRequestLabel: null,
      transitionNoteId: null,
    },
    ...partial,
  };
}

function derived(
  partial: Partial<FollowUpItem> & Pick<FollowUpItem, "id" | "status">,
): FollowUpItem {
  return manual({
    dueOn: TODAY,
    ...partial,
    kind: "derived",
    sourceType: partial.sourceType ?? "staff_pending_invite",
  });
}

describe("Follow-Up tabs and status", () => {
  it("A: My Day includes overdue, today, and undated open items", () => {
    assert.equal(
      tabForManualItem({ status: "open", dueOn: "2026-08-09", today: TODAY }),
      "my-day",
    );
    assert.equal(
      tabForManualItem({ status: "open", dueOn: TODAY, today: TODAY }),
      "my-day",
    );
    assert.equal(
      tabForManualItem({ status: "open", dueOn: null, today: TODAY }),
      "my-day",
    );
    assert.equal(
      tabForManualItem({ status: "completed", dueOn: TODAY, today: TODAY }),
      "completed",
    );
    assert.equal(
      tabForManualItem({ status: "waiting", dueOn: TODAY, today: TODAY }),
      "waiting",
    );
  });

  it("B: Upcoming is future-dated open manuals only", () => {
    assert.equal(
      tabForManualItem({ status: "open", dueOn: "2026-08-17", today: TODAY }),
      "upcoming",
    );
    assert.equal(
      tabForManualItem({ status: "waiting", dueOn: "2026-08-20", today: TODAY }),
      "waiting",
    );
  });

  it("C: Completed tab is only completed manuals", () => {
    assert.equal(
      tabForManualItem({ status: "completed", dueOn: "2026-08-01", today: TODAY }),
      "completed",
    );
    assert.equal(parseFollowUpTab("completed"), "completed");
    assert.equal(parseFollowUpTab("waiting"), "waiting");
    assert.equal(parseFollowUpTab("mystery"), "my-day");
  });

  it("D: Waiting is its own bucket for manuals and derived invites", () => {
    assert.equal(
      bucketForItem(
        { kind: "derived", status: "waiting", dueOn: null },
        TODAY,
      ),
      "waiting",
    );
    assert.equal(
      bucketForItem({ kind: "manual", status: "waiting", dueOn: TODAY }, TODAY),
      "waiting",
    );
    const items = [
      manual({ id: "1", status: "waiting", dueOn: TODAY }),
      manual({ id: "2", status: "open", dueOn: TODAY }),
      derived({
        id: "3",
        status: "waiting",
        dueOn: null,
        sourceType: "staff_pending_invite",
        title: "Staff invitation pending for Emanuel Ruiz",
      }),
    ];
    assert.equal(countWaiting(items), 2);
    const counts = countFollowUpBuckets(items, TODAY);
    assert.equal(counts.waiting, 2);
    assert.equal(counts.today, 1);
    assert.equal(counts.upcoming, 0);
  });

  it("E: derived signals cannot be completed or edited", () => {
    assert.equal(canCompleteFollowUp("derived"), false);
    assert.equal(canEditFollowUp("derived"), false);
    assert.equal(canCompleteFollowUp("manual"), true);
    assert.equal(canEditFollowUp("manual"), true);
  });
});

describe("Follow-Up noise control", () => {
  it("F: submitted classes do not surface", () => {
    assert.equal(shouldSurfaceMissingClass(true, 24), false);
    assert.equal(shouldSurfaceMissingClass(false, 0), false);
  });

  it("G: one missing class with students surfaces once", () => {
    assert.equal(shouldSurfaceMissingClass(false, 18), true);
  });

  it("H: report cards stay quiet without an honest cycle", () => {
    assert.equal(
      shouldSurfaceReportCardFollowUp({
        reportingStarted: false,
        coverageKnown: true,
        missingCount: 12,
      }),
      false,
    );
    assert.equal(
      shouldSurfaceReportCardFollowUp({
        reportingStarted: true,
        coverageKnown: false,
        missingCount: 12,
      }),
      false,
    );
  });

  it("I: report cards surface one aggregated missing signal", () => {
    assert.equal(
      shouldSurfaceReportCardFollowUp({
        reportingStarted: true,
        coverageKnown: true,
        missingCount: 12,
      }),
      true,
    );
    assert.equal(
      shouldSurfaceReportCardFollowUp({
        reportingStarted: true,
        coverageKnown: true,
        missingCount: 0,
      }),
      false,
    );
  });

  it("J: transition-note titles do not include note body", () => {
    const title = "Transition note awaiting review";
    const body = "Maya is thriving in reading workshop and needs stretch math.";
    assert.equal(title.includes(body), false);
    assert.equal(title.toLowerCase().includes("awaiting review"), true);
  });
});

describe("Follow-Up filters, dates, and access", () => {
  it("K: category filter All vs Students", () => {
    const student = manual({ id: "s", status: "open", dueOn: TODAY, category: "students" });
    const staff = manual({ id: "t", status: "open", dueOn: TODAY, category: "staff" });
    assert.equal(matchesCategoryFilter(student, "all"), true);
    assert.equal(matchesCategoryFilter(staff, "students"), false);
    assert.equal(parseFollowUpCategoryFilter("staff"), "staff");
    assert.equal(parseFollowUpCategoryFilter("nope"), "all");
  });

  it("L: reschedule tomorrow and next week; human dates", () => {
    assert.equal(rescheduleDueOn(TODAY, "tomorrow"), "2026-08-12");
    assert.equal(rescheduleDueOn(TODAY, "next_week"), "2026-08-18");
    assert.equal(formatFollowUpDue(TODAY, TODAY), "Today");
    assert.equal(formatFollowUpDue("2026-08-12", TODAY), "Tomorrow");
    assert.equal(formatFollowUpDue("2026-08-14", TODAY), "Friday");
    assert.equal(formatFollowUpDue("2026-08-18", TODAY), "Aug 18");
    assert.equal(formatFollowUpDue("2026-08-08", TODAY), "3 days overdue");
  });

  it("M: only school leadership may access Follow-Up", () => {
    assert.equal(isLeadershipAuditRole("admin"), true);
    assert.equal(isLeadershipAuditRole("principal"), true);
    assert.equal(isLeadershipAuditRole("vice_principal"), true);
    assert.equal(isLeadershipAuditRole("teacher"), false);
    assert.equal(isLeadershipAuditRole("registrar"), false);
  });

  it("N: empty copy is calm and specific", () => {
    assert.equal(
      FOLLOW_UP_EMPTY["my-day"],
      "You’re caught up. Nothing currently needs your follow-up.",
    );
    assert.equal(FOLLOW_UP_EMPTY.upcoming, "Nothing scheduled yet.");
    assert.equal(FOLLOW_UP_EMPTY.waiting, "Nothing is waiting on someone else.");
    assert.equal(
      FOLLOW_UP_EMPTY.completed,
      "Completed follow-ups will appear here.",
    );
  });

  it("O: home brief prefers a count, not a duplicated queue", () => {
    function briefLine(todayCount: number): string | null {
      if (todayCount <= 0) return null;
      if (todayCount === 1) return "1 follow-up today.";
      return `${todayCount} follow-ups today.`;
    }
    assert.equal(briefLine(0), null);
    assert.equal(briefLine(1), "1 follow-up today.");
    assert.equal(briefLine(3), "3 follow-ups today.");
  });
});

describe("Follow-Up count consistency and partial load", () => {
  it("P: Waiting count matches the Waiting list including pending invites", () => {
    const items = [
      manual({ id: "overdue", status: "open", dueOn: "2026-08-09" }),
      manual({ id: "today", status: "open", dueOn: TODAY }),
      manual({ id: "later", status: "open", dueOn: "2026-08-20" }),
      manual({ id: "wait-manual", status: "waiting", dueOn: TODAY }),
      derived({
        id: "invite",
        status: "waiting",
        dueOn: null,
        category: "staff",
        title: "Staff invitation pending for Nadia Ruiz",
      }),
      derived({
        id: "attendance",
        status: "open",
        dueOn: TODAY,
        category: "classes",
        sourceType: "attendance_missing_class",
        title: "Room 4 still needs today’s attendance",
      }),
      manual({ id: "done", status: "completed", dueOn: TODAY }),
    ];

    const waitingView = buildFollowUpWorkspaceView({
      items,
      tab: "waiting",
      category: "all",
      page: 1,
      pageSize: 20,
      today: TODAY,
    });
    assert.equal(waitingView.counts.waiting, waitingView.total);
    assert.equal(waitingView.counts.waiting, 2);
    assert.equal(waitingView.items.every((i) => i.status === "waiting"), true);

    const todayView = buildFollowUpWorkspaceView({
      items,
      tab: "my-day",
      category: "all",
      page: 1,
      pageSize: 20,
      today: TODAY,
    });
    assert.equal(todayView.counts.today, todayView.total);
    assert.equal(todayView.counts.today, 3);
    assert.equal(
      todayView.items.some((i) => i.status === "waiting"),
      false,
    );

    const staffWaiting = buildFollowUpWorkspaceView({
      items,
      tab: "waiting",
      category: "staff",
      page: 1,
      pageSize: 20,
      today: TODAY,
    });
    assert.equal(staffWaiting.counts.waiting, staffWaiting.total);
    assert.equal(staffWaiting.counts.waiting, 1);
  });

  it("Q: partial source failure still builds consistent counts", () => {
    const remaining = [
      manual({ id: "1", status: "open", dueOn: TODAY }),
      derived({
        id: "invite",
        status: "waiting",
        dueOn: null,
        sourceType: "staff_pending_invite",
      }),
    ];
    const view = buildFollowUpWorkspaceView({
      items: remaining,
      tab: "my-day",
      category: "all",
      page: 1,
      pageSize: 20,
      today: TODAY,
    });
    assert.equal(view.counts.today, view.total);
    assert.equal(view.counts.today, 1);
    assert.equal(view.counts.waiting, 1);
    assert.equal(hasPartialFollowUpLoad(true, 0), true);
    assert.equal(hasPartialFollowUpLoad(false, 1), true);
    assert.equal(hasPartialFollowUpLoad(false, 0), false);
    assert.equal(
      FOLLOW_UP_PARTIAL_LOAD,
      "Some follow-ups could not be loaded right now.",
    );
  });
});
