import { createClient as createAdminClient } from "@supabase/supabase-js";
import { monthBounds, monthForPush, shouldSendAlbumPush } from "../../../../lib/push-notifications";
import { isGonePushEndpoint, isPushConfigured, sendAlbumPush } from "../../../../lib/push-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_notified_month: string | null;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !adminKey || !isPushConfigured()) {
    return Response.json({ error: "Monthly push is not configured" }, { status: 503 });
  }

  const month = monthForPush(new Date());
  const { start, end } = monthBounds(month);
  const supabase = createAdminClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const activeUsers = new Set<string>();

  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("daily_entries")
      .select("id, user_id").gte("entry_date", start).lt("entry_date", end)
      .order("id").range(from, from + 499);
    if (error) return Response.json({ error: "Could not load album recipients" }, { status: 503 });
    data.forEach((entry) => activeUsers.add(entry.user_id));
    if (data.length < 500) break;
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;
  const subscriptions: SubscriptionRow[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, last_notified_month")
      .order("id").range(from, from + 499);
    if (error) return Response.json({ error: "Could not load push subscriptions" }, { status: 503 });
    subscriptions.push(...data as SubscriptionRow[]);
    if (data.length < 500) break;
  }

  for (const subscription of subscriptions) {
    if (!shouldSendAlbumPush(subscription.user_id, subscription.last_notified_month, activeUsers, month)) continue;
    try {
      await sendAlbumPush({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, month);
      const { error: updateError } = await supabase.from("push_subscriptions")
        .update({ last_notified_month: month, updated_at: new Date().toISOString() })
        .eq("id", subscription.id);
      if (updateError) failed += 1;
      else sent += 1;
    } catch (pushError) {
      if (isGonePushEndpoint(pushError)) {
        const { error: deleteError } = await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        if (deleteError) failed += 1;
        else removed += 1;
      } else failed += 1;
    }
  }

  return Response.json({ month, sent, failed, removed }, {
    status: failed ? 503 : 200,
    headers: { "cache-control": "no-store" },
  });
}
