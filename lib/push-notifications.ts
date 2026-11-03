import { previousMonthKey } from "./monthly-albums.ts";

export type PushSubscriptionData = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function isAllowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:"
      && !url.username && !url.password
      && (!url.port || url.port === "443")
      && (
        hostname === "fcm.googleapis.com"
        || hostname === "updates.push.services.mozilla.com"
        || hostname.endsWith(".push.apple.com")
        || hostname.endsWith(".notify.windows.com")
      );
  } catch {
    return false;
  }
}

export function parsePushSubscription(value: unknown): PushSubscriptionData | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof candidate.endpoint !== "string" || candidate.endpoint.length > 2048
    || !isAllowedPushEndpoint(candidate.endpoint)) return null;
  const p256dh = candidate.keys?.p256dh;
  const auth = candidate.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string"
    || !/^[A-Za-z0-9_-]{40,200}$/.test(p256dh)
    || !/^[A-Za-z0-9_-]{16,100}$/.test(auth)) return null;
  return { endpoint: candidate.endpoint, keys: { p256dh, auth } };
}

export function monthBounds(month: string) {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error("Invalid album month");
  const start = `${month}-01`;
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1));
  const end = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export function monthForPush(now: Date) {
  return previousMonthKey(now);
}

export function shouldSendAlbumPush(userId: string, lastNotifiedMonth: string | null, activeUsers: Set<string>, month: string) {
  return activeUsers.has(userId) && lastNotifiedMonth !== month;
}

export function albumPushPayload(month: string) {
  if (!MONTH_PATTERN.test(month)) throw new Error("Invalid album month");
  return JSON.stringify({ type: "monthly-album", month });
}
