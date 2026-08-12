import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildClassesHref,
  classDisplayName,
  classMatchesFilters,
  operationalFiltersFrom,
  parseClassManagementFilters,
  summarizeClassManagementMetrics,
  type ClassManagementMetricRow,
} from "./class-management-filters";

function row(
  partial: Partial<ClassManagementMetricRow> & {
    is_active: boolean;
    name: string;
  },
): ClassManagementMetricRow {
  return {
    grade_level_id: partial.grade_level_id ?? "g1",
    section: partial.section ?? null,
    gradeLevelName: partial.gradeLevelName ?? "Grade 5",
    teachers: partial.teachers ?? [],
    studentEnrollmentCount: partial.studentEnrollmentCount ?? 0,
    ...partial,
  };
}

describe("Admin Classes — status filter defaults", () => {
  const grades = new Set(["g1", "g2"]);

  it("defaults to active when status is omitted (A, B, I)", () => {
    const filters = parseClassManagementFilters({}, grades);
    assert.equal(filters.status, "active");
    assert.equal(filters.q, "");
    assert.equal(filters.gradeLevelId, null);
  });

  it("maps legacy status=all to active operational view", () => {
    assert.equal(parseClassManagementFilters({ status: "all" }, grades).status, "active");
    assert.equal(parseClassManagementFilters({ status: "weird" }, grades).status, "active");
  });

  it("accepts archived explicitly for archive view (C)", () => {
    assert.equal(
      parseClassManagementFilters({ status: "archived" }, grades).status,
      "archived",
    );
  });
});

describe("Admin Classes — list matching", () => {
  const active = row({
    is_active: true,
    name: "5B",
    teachers: [{ teacherProfileId: "t1", teacherLabel: "Ada Teacher" }],
    studentEnrollmentCount: 40,
  });
  const archivedA = row({
    is_active: false,
    name: "4A",
    teachers: [{ teacherProfileId: "t2", teacherLabel: "Bea Teacher" }],
    studentEnrollmentCount: 12,
  });
  const archivedB = row({
    is_active: false,
    name: "3C",
    teachers: [{ teacherProfileId: "t1", teacherLabel: "Ada Teacher" }],
    studentEnrollmentCount: 8,
  });

  it("default active filter shows only active classes (B)", () => {
    const filters = parseClassManagementFilters({}, new Set(["g1"]));
    const visible = [active, archivedA, archivedB].filter((c) =>
      classMatchesFilters(c, filters),
    );
    assert.deepEqual(
      visible.map((c) => c.name),
      ["5B"],
    );
  });

  it("archive filter shows only archived classes (C)", () => {
    const filters = parseClassManagementFilters({ status: "archived" }, new Set(["g1"]));
    const visible = [active, archivedA, archivedB].filter((c) =>
      classMatchesFilters(c, filters),
    );
    assert.deepEqual(
      visible.map((c) => c.name),
      ["4A", "3C"],
    );
  });

  it("operational pulse ignores archive status and counts active only (A, F)", () => {
    const archivedView = parseClassManagementFilters({ status: "archived" }, new Set(["g1"]));
    const operational = [active, archivedA, archivedB].filter((c) =>
      classMatchesFilters(c, operationalFiltersFrom(archivedView)),
    );
    const metrics = summarizeClassManagementMetrics(operational);
    assert.equal(metrics.classCount, 1);
    assert.equal(metrics.teacherCount, 1);
    assert.equal(metrics.studentCount, 40);
  });

  it("archive then restore semantics keep a single row identity (D, E)", () => {
    // Archive flips is_active; restore flips it back — no duplicate row created.
    let klass = row({ is_active: true, name: "5B", studentEnrollmentCount: 40 });
    assert.equal(classMatchesFilters(klass, { q: "", status: "active", gradeLevelId: null }), true);

    klass = { ...klass, is_active: false };
    assert.equal(classMatchesFilters(klass, { q: "", status: "active", gradeLevelId: null }), false);
    assert.equal(
      classMatchesFilters(klass, { q: "", status: "archived", gradeLevelId: null }),
      true,
    );

    klass = { ...klass, is_active: true };
    assert.equal(classMatchesFilters(klass, { q: "", status: "active", gradeLevelId: null }), true);
    assert.equal(
      classMatchesFilters(klass, { q: "", status: "archived", gradeLevelId: null }),
      false,
    );
  });
});

describe("Admin Classes — href and labels", () => {
  it("omits status from URL when active (I)", () => {
    assert.equal(
      buildClassesHref("/dashboard/admin/classes", {
        q: "",
        status: "active",
        gradeLevelId: null,
      }),
      "/dashboard/admin/classes",
    );
    assert.equal(
      buildClassesHref("/dashboard/admin/classes", {
        q: "5B",
        status: "archived",
        gradeLevelId: "g1",
      }),
      "/dashboard/admin/classes?q=5B&status=archived&grade=g1",
    );
  });

  it("formats class display names for archive confirmation", () => {
    assert.equal(classDisplayName({ name: "5B", section: null }), "5B");
    assert.equal(classDisplayName({ name: "Homeroom", section: "A" }), "Homeroom A");
  });
});
