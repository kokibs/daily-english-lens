import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_ENGLISH_LEVEL, ENGLISH_LEVEL_DESCRIPTIONS, ENGLISH_LEVEL_EXAMPLES, ENGLISH_LEVEL_LABELS, ENGLISH_LEVELS, isEnglishLevel } from "../lib/english-level.ts";

test("offers four levels with a matching description and example while preserving the saved default", () => {
  assert.equal(DEFAULT_ENGLISH_LEVEL, "intermediate");
  assert.deepEqual(ENGLISH_LEVELS, ["intro", "beginner", "intermediate", "advanced"]);
  assert.deepEqual(ENGLISH_LEVEL_LABELS, {
    intro: "入門",
    beginner: "初級",
    intermediate: "中級",
    advanced: "上級",
  });
  assert.deepEqual(ENGLISH_LEVEL_DESCRIPTIONS, {
    intro: "基本的な単語と短い英文",
    beginner: "身近な出来事をシンプルな英語で",
    intermediate: "日常会話で使える自然な表現",
    advanced: "豊かな言い回しや細かなニュアンス",
  });
  assert.deepEqual(ENGLISH_LEVEL_EXAMPLES, {
    intro: { english: "It's raining.", japanese: "雨が降っている。" },
    beginner: { english: "I forgot my umbrella.", japanese: "傘を忘れた。" },
    intermediate: { english: "I got caught in the rain.", japanese: "雨に降られた。" },
    advanced: { english: "The rain came out of nowhere.", japanese: "突然雨が降り出した。" },
  });
  assert.equal(isEnglishLevel("intro"), true);
  assert.equal(isEnglishLevel("beginner"), true);
  assert.equal(isEnglishLevel("advanced"), true);
  assert.equal(isEnglishLevel("expert"), false);
  assert.equal(isEnglishLevel(null), false);
});
