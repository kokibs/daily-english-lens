import assert from "node:assert/strict";
import test from "node:test";

import { translateLegacyReviewClues } from "../lib/review-clue-repair.ts";

const legacy = [{
  id: "festival-expression",
  example: "I went to a school festival at Kobe College.",
  japanese: "神戸女学院の文化祭に行く",
}];

test("legacy clue repair translates the complete example while retaining the id", async () => {
  let body;
  const fakeFetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify({
      clues: [{ id: legacy[0].id, japanese: "神戸女学院の文化祭に行った。" }],
    }) }] }] });
  };
  const clues = await translateLegacyReviewClues(legacy, "test-key", "test-model", fakeFetch);
  assert.equal(clues.get(legacy[0].id), "神戸女学院の文化祭に行った。");
  assert.match(body.instructions, /Preserve the subject, action, tense/);
  assert.match(body.instructions, /wrong tense/);
  assert.equal(body.store, false);
  assert.ok(!JSON.stringify(body).includes("data:image"));
});

test("legacy clue repair rejects missing or duplicate translations", async () => {
  const fakeFetch = async () => Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify({
    clues: [{ id: "wrong-id", japanese: "文化祭に行った。" }],
  }) }] }] });
  await assert.rejects(translateLegacyReviewClues(legacy, "test-key", "test-model", fakeFetch), /invalid translations/);
});
