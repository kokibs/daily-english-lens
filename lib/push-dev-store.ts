import type { PushSubscriptionData } from "./push-notifications";

type DevSubscription = PushSubscriptionData & { userId: string };
const globalStore = globalThis as typeof globalThis & {
  dailyEnglishLensDevPushSubscriptions?: Map<string, DevSubscription>;
};

const subscriptions = globalStore.dailyEnglishLensDevPushSubscriptions ?? new Map<string, DevSubscription>();
globalStore.dailyEnglishLensDevPushSubscriptions = subscriptions;

export function saveDevPushSubscription(userId: string, subscription: PushSubscriptionData) {
  subscriptions.set(subscription.endpoint, { ...subscription, userId });
}

export function removeDevPushSubscription(userId: string, endpoint: string) {
  if (subscriptions.get(endpoint)?.userId === userId) subscriptions.delete(endpoint);
}

export function devPushSubscriptionsForUser(userId: string) {
  return [...subscriptions.values()].filter((subscription) => subscription.userId === userId);
}
