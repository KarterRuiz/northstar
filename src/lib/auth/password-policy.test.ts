import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NORTHSTAR_MIN_PASSWORD_LENGTH,
  validateNorthStarPassword,
} from "@/lib/auth/password-policy";

describe("validateNorthStarPassword", () => {
  it("requires both fields", () => {
    assert.equal(validateNorthStarPassword("", "").ok, false);
    assert.equal(validateNorthStarPassword("abcdefgh", "").ok, false);
    assert.equal(validateNorthStarPassword("", "abcdefgh").ok, false);
  });

  it("requires a match", () => {
    const result = validateNorthStarPassword("abcdefgh", "abcdefgH");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /do not match/i);
  });

  it(`requires at least ${NORTHSTAR_MIN_PASSWORD_LENGTH} characters`, () => {
    const result = validateNorthStarPassword("short", "short");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /8 characters/i);
  });

  it("accepts matching passwords that meet the policy", () => {
    assert.deepEqual(validateNorthStarPassword("securePass1", "securePass1"), {
      ok: true,
    });
  });
});
