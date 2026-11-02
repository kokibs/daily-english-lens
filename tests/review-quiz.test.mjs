import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeReviewAnswer,
  requestReviewGrade,
  reviewItemKey,
  reviewItemsForEntry,
  reviewJapanesePrompt,
  reviewWordCount,
  reviewWordHints,
} from "../lib/review-quiz.ts";

const entry = {
  id: "saved-day",
  date: "2026-10-03",
  photos: [{ id: "festival", imageUrl: "festival-photo" }],
  diaryEnglish: "I went to the school festival at Kobe College and saw the decorations.",
  diaryJapanese: "神戸女学院の文化祭に行き、装飾を見た。",
  moments: [{ photoId: "festival", english: "I went to the school festival at Kobe College and saw the decorations.", japanese: "神戸女学院の文化祭に行き、装飾を見た。" }],
  expressions: [
    { id: "festival-expression", photoId: "festival", expression: "go to a school festival", japanese: "神戸女学院の文化祭に行く", example: "I went to a school festival at Kobe College.", explanation: "学校祭に行ったことを話す。", cloze: "I ______ at Kobe College." },
    { id: "decoration-expression", photoId: "festival", expression: "an interesting decoration", japanese: "面白い装飾", example: "I saw an interesting decoration with waves and stars.", explanation: "装飾について話す。", cloze: "I saw ______ with waves and stars." },
  ],
};

test("review uses the highlighted expression's Japanese clue and complete short example", () => {
  const items = reviewItemsForEntry(entry);

  assert.equal(items.length, 2);
  assert.equal(reviewJapanesePrompt(items[0]), "神戸女学院の文化祭に行く");
  assert.equal(items[0].expression.example, "I went to a school festival at Kobe College.");
  assert.equal(reviewWordCount(items[0]), 9);
  assert.deepEqual(reviewWordHints(items[0]), ["went", "school"]);
  assert.equal(reviewItemKey(items[0]), "saved-day:festival-expression");
});

test("review skips expressions without an answer and replaces legacy blank clues", () => {
  const withBlankClue = {
    ...entry,
    expressions: [
      { ...entry.expressions[0], japanese: "___の文化祭に行く" },
      { ...entry.expressions[1], example: "" },
    ],
  };
  const items = reviewItemsForEntry(withBlankClue);

  assert.equal(items.length, 1);
  assert.equal(reviewJapanesePrompt(items[0]), entry.moments[0].japanese);
});

test("answer normalization tolerates punctuation and case but not only the extracted phrase", () => {
  const example = entry.expressions[0].example;
  assert.equal(normalizeReviewAnswer(example), normalizeReviewAnswer("i went to a school festival at kobe college"));
  assert.notEqual(normalizeReviewAnswer(example), normalizeReviewAnswer("go to a school festival"));
  assert.notEqual(normalizeReviewAnswer(example), normalizeReviewAnswer("I want to a school festival at Kobe College"));
});

test("review asks the server to judge paraphrases against the visible clue", async () => {
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return Response.json({ grade: "correct" });
  };

  const grade = await requestReviewGrade(
    "神戸女学院の文化祭に行く",
    "I went to a school festival at Kobe College.",
    "I attended Kobe College's school festival.",
    fakeFetch,
  );

  assert.equal(grade, "correct");
  assert.equal(captured.url, "/api/review/check");
  assert.equal(captured.body.clue, "神戸女学院の文化祭に行く");
  assert.equal(captured.body.answer, "I attended Kobe College's school festival.");
});

test("review leaves a failed grading request retryable", async () => {
  await assert.rejects(
    requestReviewGrade("文化祭に行く", "I went to a school festival.", "I attended a school festival.",
      async () => Response.json({ error: "回答を判定できませんでした。" }, { status: 502 })),
    /回答を判定できませんでした/,
  );
});
