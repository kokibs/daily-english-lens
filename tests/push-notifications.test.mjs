import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { albumPushPayload, monthBounds, monthForPush, parsePushSubscription, shouldSendAlbumPush, validatePushSubscription } from "../lib/push-notifications.ts";

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/example",
  keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
};

test("accepts a browser push endpoint but rejects arbitrary destinations", () => {
  assert.deepEqual(parsePushSubscription(subscription), subscription);
  assert.deepEqual(parsePushSubscription({ ...subscription, endpoint: "https://jmt17.google.com/fcm/send/example" }), {
    ...subscription, endpoint: "https://jmt17.google.com/fcm/send/example",
  });
  assert.equal(parsePushSubscription({ ...subscription, endpoint: "https://jmt17.google.com/collect" }), null);
  assert.equal(parsePushSubscription({ ...subscription, endpoint: "https://example.com/collect" }), null);
  assert.equal(parsePushSubscription({ ...subscription, endpoint: "http://fcm.googleapis.com/fcm/send/example" }), null);
  assert.match(validatePushSubscription({ ...subscription, endpoint: "https://push.example.com/collect" }).error, /push\.example\.com/);
  assert.equal(validatePushSubscription({ ...subscription, keys: {} }).error, "通知用の暗号化情報を読み取れませんでした。");
});

test("sends only for a completed month with entries and only once per subscription", () => {
  assert.deepEqual(monthBounds("2026-12"), { start: "2026-12-01", end: "2027-01-01" });
  assert.equal(monthForPush(new Date("2026-11-01T00:00:00Z")), "2026-10");
  assert.equal(shouldSendAlbumPush("user-a", null, new Set(["user-a"]), "2026-10"), true);
  assert.equal(shouldSendAlbumPush("user-a", "2026-10", new Set(["user-a"]), "2026-10"), false);
  assert.equal(shouldSendAlbumPush("user-b", null, new Set(["user-a"]), "2026-10"), false);
  assert.deepEqual(JSON.parse(albumPushPayload("2026-10")), { type: "monthly-album", month: "2026-10" });
  assert.throws(() => monthBounds("2026-13"));
});

test("tapping the monthly notification opens that month's movie", async () => {
  const listeners = new Map();
  const opened = [];
  const self = {
    location: { origin: "https://daily-english-lens.example" },
    addEventListener: (name, listener) => listeners.set(name, listener),
    clients: {
      matchAll: async () => [],
      openWindow: async (url) => { opened.push(url); },
    },
  };
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { self, URL });

  let work;
  listeners.get("notificationclick")({
    notification: { data: { month: "2026-10" }, close() {} },
    waitUntil: (promise) => { work = promise; },
  });
  await work;

  assert.deepEqual(opened, ["https://daily-english-lens.example/?album=2026-10&play=1"]);
});
