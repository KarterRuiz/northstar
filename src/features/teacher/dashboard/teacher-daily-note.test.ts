import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTeacherDailyNote } from "./teacher-daily-note";

describe("getTeacherDailyNote", () => {
  it("stays stable for the same date and rotates the next day", () => {
    const jan1 = new Date(2026, 0, 1);
    const jan2 = new Date(2026, 0, 2);
    const first = getTeacherDailyNote(jan1);
    assert.equal(getTeacherDailyNote(jan1), first);
    assert.notEqual(getTeacherDailyNote(jan2), first);
    assert.ok(first.length < 80);
  });
});
