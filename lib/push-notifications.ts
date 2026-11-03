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
        || (/^jmt\d{1,3}\.google\.com$/.test(hostname) && url.pathname.startsWith("/fcm/send/"))
        || hostname === "updates.push.services.mozilla.com"
        || hostname.endsWith(".push.apple.com")
        || hostname.endsWith(".notify.windows.com")
      );
  } catch {
    return false;
  }
}

export function validatePushSubscription(value: unknown):
  | { subscription: PushSubscriptionData; error: null }
  | { subscription: null; error: string } {
  if (!value || typeof value !== "object") return { subscription: null, error: "通知登録の形式が正しくありません。" };
  const candidate = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof candidate.endpoint !== "string" || candidate.endpoint.length > 2048) {
    return { subscription: null, error: "通知登録のURLを読み取れませんでした。" };
  }
  if (!isAllowedPushEndpoint(candidate.endpoint)) {
    let hostname = "不明";
    try { hostname = new URL(candidate.endpoint).hostname.slice(0, 100); } catch { /* Keep a generic message for malformed URLs. */ }
    return { subscription: null, error: `このブラウザの通知サービス（${hostname}）に未対応です。` };
  }
  const p256dh = candidate.keys?.p256dh;
  const auth = candidate.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string"
    || !/^[A-Za-z0-9_-]{40,200}$/.test(p256dh)
    || !/^[A-Za-z0-9_-]{16,100}$/.test(auth)) {
    return { subscription: null, error: "通知用の暗号化情報を読み取れませんでした。" };
  }
  return { subscription: { endpoint: candidate.endpoint, keys: { p256dh, auth } }, error: null };
}

export function parsePushSubscription(value: unknown): PushSubscriptionData | null {
  return validatePushSubscription(value).subscription;
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
