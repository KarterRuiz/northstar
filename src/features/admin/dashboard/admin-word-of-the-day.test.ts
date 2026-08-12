import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ADMIN_WORDS_OF_THE_DAY,
  getAdminWordOfTheDay,
} from "./admin-word-of-the-day";

describe("getAdminWordOfTheDay", () => {
  it("rotates by day-of-year and stays stable for the same date", () => {
    const jan1 = new Date(2026, 0, 1);
    const jan2 = new Date(2026, 0, 2);
    const first = getAdminWordOfTheDay(jan1);
    const second = getAdminWordOfTheDay(jan2);

    assert.equal(first.word, ADMIN_WORDS_OF_THE_DAY[1]!.word);
    assert.equal(second.word, ADMIN_WORDS_OF_THE_DAY[2]!.word);
    assert.equal(getAdminWordOfTheDay(jan1).word, first.word);
    assert.notEqual(first.word, second.word);
  });

  it("wraps after the curated list length", () => {
    const day = ADMIN_WORDS_OF_THE_DAY.length + 1;
    const date = new Date(2026, 0, day);
    assert.equal(
      getAdminWordOfTheDay(date).word,
      ADMIN_WORDS_OF_THE_DAY[1]!.word,
    );
  });
});
