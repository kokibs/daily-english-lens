import assert from "node:assert/strict";
import test from "node:test";
import { textForNarration } from "../lib/narration-text.ts";

test("narration expands a diary's a.m. and p.m. times without changing the displayed sentence", () => {
  const original = "Around 11 p.m., I watched VIVANT. Around 1 a.m., I saw the poster.";
  assert.equal(textForNarration(original),
    "Around eleven at night, I watched VIVANT. Around one in the morning, I saw the poster.");
  assert.match(original, /11 p\.m\./);
});

test("narration handles minutes, noon, and midnight", () => {
  assert.equal(textForNarration("At 2:54 p.m., I left. At 12 p.m., I ate. At 12 a.m., I slept."),
    "At two fifty-four in the afternoon, I left. At noon, I ate. At midnight, I slept.");
});
