import assert from "node:assert/strict";
import test from "node:test";

import { albumMonthLabel, albumReadyForNotification, albumStoryFrames, monthlyAlbums, previousMonthKey } from "../lib/monthly-albums.ts";

const day = (id, date, photos) => ({
  id, date, photos: photos.map((photoId) => ({ id: photoId, imageUrl: photoId })),
  diaryEnglish: `English for ${id}`, diaryJapanese: `日本語 ${id}`, moments: [], expressions: [],
});

test("saved days become newest-first monthly albums with their original photos", () => {
  const albums = monthlyAlbums([
    day("oct-early", "2026-10-03", ["one"]),
    day("sep", "2026-09-30", ["old"]),
    day("oct-late", "2026-10-25", ["two", "three"]),
  ]);

  assert.deepEqual(albums.map((album) => album.month), ["2026-10", "2026-09"]);
  assert.deepEqual(albums[0].entries.map((entry) => entry.id), ["oct-late", "oct-early"]);
  assert.deepEqual(albums[0].photos.map((photo) => photo.id), ["two", "three", "one"]);
  assert.equal(albumMonthLabel("2026-10"), "2026年10月");
});

test("monthly notice offers only the previous completed calendar month", () => {
  const albums = monthlyAlbums([
    day("nov", "2026-11-01", ["new"]),
    day("oct", "2026-10-31", ["old"]),
  ]);

  assert.equal(previousMonthKey(new Date("2026-11-02T00:00:00+09:00")), "2026-10");
  assert.equal(previousMonthKey(new Date("2027-01-01T00:00:00+09:00")), "2026-12");
  assert.equal(albumReadyForNotification(albums, new Date("2026-11-02T00:00:00+09:00"))?.month, "2026-10");
  assert.equal(albumReadyForNotification(albums, new Date("2026-12-02T00:00:00+09:00"))?.month, "2026-11");
  assert.equal(albumReadyForNotification(albums, new Date("2027-01-02T00:00:00+09:00")), null);
});

test("the movie pairs every photo with its own English and plays days in date order", () => {
  const early = day("early", "2026-10-03", ["shrine", "meal"]);
  early.moments = [{ photoId: "shrine", english: "I visited a shrine.", japanese: "神社を訪れた。" }];
  early.expressions = [{ photoId: "meal", example: "I enjoyed lunch.", japanese: "昼食を楽しんだ。" }];
  const late = day("late", "2026-10-25", ["sky"]);
  late.moments = [{ photoId: "sky", english: "I watched the sunset.", japanese: "夕日を眺めた。" }];

  const album = monthlyAlbums([late, early])[0];
  const frames = albumStoryFrames(album);
  assert.deepEqual(frames.map((frame) => frame.photo.id), ["shrine", "meal", "sky"]);
  assert.deepEqual(frames.map((frame) => frame.english), [
    "I visited a shrine.",
    "I enjoyed lunch.",
    "I watched the sunset.",
  ]);
  assert.deepEqual(frames.map((frame) => frame.japanese), ["神社を訪れた。", "昼食を楽しんだ。", "夕日を眺めた。"]);
  assert.deepEqual(album.entries.map((entry) => entry.id), ["late", "early"]);
});
