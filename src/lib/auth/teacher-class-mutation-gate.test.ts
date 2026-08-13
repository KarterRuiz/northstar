import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { canManageSchoolStructure } from "@/config/roles";
import {
  teacherClassMutationDeniedMessage,
  teacherMayPerformClassMutation,
} from "@/lib/auth/teacher-class-mutation-gate";
import { CLASS_DATA_CENTER_TAB_PERMISSIONS } from "@/features/classes/class-data-center/constants";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260813180000_restore_active_class_mutation_gate.sql",
);
const brokenMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260808210000_staff_grade_level_access.sql",
);
const archiveMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260516180000_class_archive_safe_delete.sql",
);

function readMigration(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

describe("Archived class write protection — SQL gate", () => {
  it("H. restore migration does not DELETE historical records", () => {
    const sql = readMigration(migrationPath);
    assert.equal(/\bdelete\s+from\b/i.test(sql), false);
    assert.equal(/\btruncate\b/i.test(sql), false);
    assert.equal(/\bdrop\s+table\b/i.test(sql), false);
  });

  it("restores is_active on teacher_is_assigned_to_class (not teacher_can_access_class)", () => {
    const sql = readMigration(migrationPath);
    assert.match(sql, /create or replace function public\.teacher_is_assigned_to_class/i);
    assert.match(sql, /teacher_can_access_class\s*\(\s*p_class_id\s*\)/i);
    assert.match(sql, /c\.is_active\s*=\s*true/i);
    // Must not redefine the read helper in this migration.
    assert.equal(/create or replace function public\.teacher_can_access_class/i.test(sql), false);
  });

  it("documents the regression: grade-level migration aliased mutation to read access", () => {
    const broken = readMigration(brokenMigrationPath);
    const assignedBody = broken.slice(
      broken.indexOf("create or replace function public.teacher_is_assigned_to_class"),
      broken.indexOf("create or replace function public.teacher_can_access_student"),
    );
    assert.match(assignedBody, /select public\.teacher_can_access_class/);
    assert.equal(/is_active\s*=\s*true/.test(assignedBody), false);

    const archive = readMigration(archiveMigrationPath);
    assert.match(archive, /c\.is_active\s*=\s*true/);
  });
});

describe("Archived class write protection — mutation semantics A–G, J", () => {
  it("A. active class + assigned teacher → mutation allowed", () => {
    assert.equal(
      teacherMayPerformClassMutation({ hasClassAccess: true, classIsActive: true }),
      true,
    );
  });

  it("B. archived class + assigned teacher → mutation denied", () => {
    assert.equal(
      teacherMayPerformClassMutation({ hasClassAccess: true, classIsActive: false }),
      false,
    );
  });

  it("C. archived class + grade-level access → mutation denied", () => {
    // Grade-level expands hasClassAccess; active gate still blocks writes.
    assert.equal(
      teacherMayPerformClassMutation({ hasClassAccess: true, classIsActive: false }),
      false,
    );
  });

  it("D. active class attendance save → auth helper allows", () => {
    assert.equal(
      teacherMayPerformClassMutation({ hasClassAccess: true, classIsActive: true }),
      true,
    );
  });

  it("E. archived class attendance save → denied with clean message", () => {
    assert.equal(
      teacherMayPerformClassMutation({ hasClassAccess: true, classIsActive: false }),
      false,
    );
    assert.match(
      teacherClassMutationDeniedMessage({ classIsArchived: true }),
      /archived/i,
    );
  });

  it("F. active class grade save → allowed", () => {
    assert.equal(
      teacherMayPerformClassMutation({ hasClassAccess: true, classIsActive: true }),
      true,
    );
  });

  it("G. archived class grade save → denied", () => {
    assert.equal(
      teacherMayPerformClassMutation({ hasClassAccess: true, classIsActive: false }),
      false,
    );
  });

  it("J. teacher deep link cannot bypass: no access or inactive both deny", () => {
    assert.equal(
      teacherMayPerformClassMutation({ hasClassAccess: false, classIsActive: true }),
      false,
    );
    assert.equal(
      teacherMayPerformClassMutation({ hasClassAccess: true, classIsActive: false }),
      false,
    );
    assert.equal(
      teacherMayPerformClassMutation({ hasClassAccess: false, classIsActive: false }),
      false,
    );
    assert.equal(
      teacherClassMutationDeniedMessage({ classIsArchived: false }),
      "You are not assigned to this class.",
    );
  });
});

describe("Archived class write protection — leadership historical review I", () => {
  it("I. Class Data Center academics stay read-only; leadership structure access intact", () => {
    assert.equal(CLASS_DATA_CENTER_TAB_PERMISSIONS.academics.write, false);
    assert.equal(CLASS_DATA_CENTER_TAB_PERMISSIONS.academics.read, true);
    assert.equal(CLASS_DATA_CENTER_TAB_PERMISSIONS.attendance.write, false);
    assert.equal(canManageSchoolStructure("admin"), true);
    assert.equal(canManageSchoolStructure("principal"), true);
    assert.equal(canManageSchoolStructure("teacher"), false);
  });
});
