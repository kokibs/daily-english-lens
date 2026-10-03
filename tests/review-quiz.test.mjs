import assert from "node:assert/strict";
import test from "node:test";

import { normalizeReviewAnswer, reviewItemKey, reviewItemsForEntry } from "../lib/review-quiz.ts";

const entry = {
  id: "saved-day",
  date: "2026-08-30",
  photos: [
    { id: "louvre", imageUrl: "louvre-photo" },
    { id: "venus", imageUrl: "venus-photo" },
  ],
  diaryEnglish: "I visited the Louvre Museum and saw the Venus de Milo.",
  diaryJapanese: "ルーブル美術館を訪れ、ミロのヴィーナスを見た。",
  moments: [
    { photoId: "louvre", english: "I visited the Louvre Museum in Paris.", japanese: "パリのルーブル美術館を訪れた。" },
    { photoId: "venus", english: "I saw the beautiful Venus de Milo.", japanese: "美しいミロのヴィーナスを見た。" },
  ],
  expressions: [
    { id: "old-expression", photoId: "louvre", expression: "visit a museum", japanese: "美術館を訪れる", example: "I visited a museum.", explanation: "", cloze: "I ______ a museum." },
  ],
};

test("review uses one complete sentence per photo, not the stored expression example", () => {
  const items = reviewItemsForEntry(entry);

  assert.equal(items.length, 2);
  assert.equal(items[0].moment.english, "I visited the Louvre Museum in Paris.");
  assert.equal(items[0].moment.japanese, "パリのルーブル美術館を訪れた。");
  assert.equal(reviewItemKey(items[0]), "saved-day:louvre");
});

test("review ignores old entries without a usable photo sentence", () => {
  assert.deepEqual(reviewItemsForEntry({ ...entry, moments: [] }), []);
  assert.deepEqual(reviewItemsForEntry({ ...entry, moments: [{ photoId: "louvre", english: "", japanese: "美術館に行った。" }] }), []);
});

test("answer normalization tolerates punctuation and case but not a partial sentence", () => {
  const full = "I visited the Louvre Museum in Paris.";
  assert.equal(normalizeReviewAnswer(full), normalizeReviewAnswer("i visited the louvre museum in paris"));
  assert.notEqual(normalizeReviewAnswer(full), normalizeReviewAnswer("visited the Louvre Museum"));
});
