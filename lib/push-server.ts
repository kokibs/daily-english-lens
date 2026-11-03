import webPush from "web-push";
import type { PushSubscriptionData } from "./push-notifications";
import { albumPushPayload } from "./push-notifications";

export function isPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendAlbumPush(subscription: PushSubscriptionData, month: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("Web Push keys are not configured");

  return webPush.sendNotification(subscription, albumPushPayload(month), {
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT || "https://daily-english-lens.vercel.app",
      publicKey,
      privateKey,
    },
    TTL: 48 * 60 * 60,
    timeout: 10_000,
    urgency: "normal",
  });
}

export function isGonePushEndpoint(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === 404 || statusCode === 410;
}
