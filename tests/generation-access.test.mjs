import assert from "node:assert/strict";
import test from "node:test";
import { hasTemporaryUnlimitedGeneration } from "../lib/generation-access.ts";

test("temporarily removes limits only for the configured account and Japan date", () => {
  const duringAugust29InJapan = new Date("2026-08-29T14:59:59.000Z");
  const afterAugust29InJapan = new Date("2026-08-29T15:00:00.000Z");

  assert.equal(hasTemporaryUnlimitedGeneration(
    "learner@example.com",
    "LEARNER@example.com",
    "2026-08-29",
    duringAugust29InJapan,
  ), true);
  assert.equal(hasTemporaryUnlimitedGeneration(
    "another@example.com",
    "learner@example.com",
    "2026-08-29",
    duringAugust29InJapan,
  ), false);
  assert.equal(hasTemporaryUnlimitedGeneration(
    "learner@example.com",
    "learner@example.com",
    "2026-08-29",
    afterAugust29InJapan,
  ), false);
});
