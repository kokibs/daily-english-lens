import assert from "node:assert/strict";
import test from "node:test";

import {
  approximatePhotoTime,
  createDailyEntryFromPhotos,
  hasLegacyTutorialOutput,
  isLegacyTutorialEntry,
} from "../lib/daily-english.ts";

test("rounds automatic photo times while leaving note text independent", () => {
  assert.equal(approximatePhotoTime(new Date(2026, 7, 29, 14, 54)), "午後3時ごろ");
  assert.equal(approximatePhotoTime(new Date(2026, 7, 29, 14, 20)), "午後2時ごろ");
  assert.equal(approximatePhotoTime("2:54 PM"), "午後3時ごろ");
  assert.equal(approximatePhotoTime("午後3時ごろ"), "午後3時ごろ");
});

test("builds the diary from uploaded photo context instead of tutorial copy", () => {
  const entry = createDailyEntryFromPhotos([
    { id: "festival", imageUrl: "data:", note: "体育祭の垂れ幕綺麗だった", label: "IMG_8302" },
    { id: "art", imageUrl: "data:", note: "富嶽36景の関数アートを書きました", label: "mathtrace-artwork" },
    { id: "code", imageUrl: "data:", note: "", label: "スクリーンショット 2026-08-16" },
  ], "2026-08-26");

  assert.match(entry.moments[0].english, /sports festival/);
  assert.match(entry.moments[1].english, /function art/);
  assert.match(entry.moments[2].english, /programming problem/);
  assert.doesNotMatch(entry.diaryEnglish, /packed train|grabbed lunch|badminton|rain/);
  assert.equal(hasLegacyTutorialOutput(entry), false);
  assert.equal(isLegacyTutorialEntry(entry), false);
  assert.equal(entry.expressions.length, 6);
  assert.ok(entry.expressions.every((item) => item.cloze.includes("______")));
});

test("recognizes the old seeded tutorial entry for removal", () => {
  const entry = createDailyEntryFromPhotos([
    "train", "lunch", "classroom", "badminton", "rain",
  ].map((id) => ({ id, imageUrl: "data:" })), "2026-08-25");

  assert.equal(isLegacyTutorialEntry(entry), true);
});
