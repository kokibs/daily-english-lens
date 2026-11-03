import { parsePushSubscription } from "../../../../lib/push-notifications";
import { devPushSubscriptionsForUser, removeDevPushSubscription, saveDevPushSubscription } from "../../../../lib/push-dev-store";
import { isPushConfigured } from "../../../../lib/push-server";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

async function context(request: Request) {
  if (!isPushConfigured()) return { error: Response.json({ error: "通知の設定が完了していません。" }, { status: 503 }) };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return { error: Response.json({ error: "このサイトから操作してください。" }, { status: 403 }) };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "ログインしてください。" }, { status: 401 }) };
  return { supabase, user };
}

async function subscriptionBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 4096) return null;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return null;
    return parsePushSubscription(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const result = await context(request);
  if (result.error) return result.error;
  const { supabase, user } = result;
  const subscription = await subscriptionBody(request);
  if (!subscription) return Response.json({ error: "通知登録を読み取れませんでした。" }, { status: 400 });

  if (request.headers.get("x-push-status") === "1") {
    if (process.env.NODE_ENV === "development") {
      return Response.json({ subscribed: devPushSubscriptionsForUser(user.id).some((item) => item.endpoint === subscription.endpoint) }, { headers: { "cache-control": "no-store" } });
    }
    const { data, error } = await supabase.from("push_subscriptions").select("id").eq("endpoint", subscription.endpoint).maybeSingle();
    if (error) return Response.json({ error: "通知登録を確認できませんでした。" }, { status: 503 });
    return Response.json({ subscribed: Boolean(data) }, { headers: { "cache-control": "no-store" } });
  }

  if (process.env.NODE_ENV === "development") {
    saveDevPushSubscription(user.id, subscription);
    return Response.json({ subscribed: true }, { headers: { "cache-control": "no-store" } });
  }

  const { data: existing, error: readError } = await supabase
    .from("push_subscriptions").select("id").eq("endpoint", subscription.endpoint).maybeSingle();
  if (readError) return Response.json({ error: "通知登録を確認できませんでした。" }, { status: 503 });

  const payload = {
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    updated_at: new Date().toISOString(),
  };
  const response = existing
    ? await supabase.from("push_subscriptions").update(payload).eq("id", existing.id)
    : await supabase.from("push_subscriptions").insert({ ...payload, user_id: user.id, endpoint: subscription.endpoint });
  if (response.error) return Response.json({ error: "通知登録を保存できませんでした。" }, { status: 503 });
  return Response.json({ subscribed: true }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(request: Request) {
  const result = await context(request);
  if (result.error) return result.error;
  const { supabase, user } = result;
  const subscription = await subscriptionBody(request);
  if (!subscription) return Response.json({ error: "通知登録を読み取れませんでした。" }, { status: 400 });

  if (process.env.NODE_ENV === "development") {
    removeDevPushSubscription(user.id, subscription.endpoint);
  } else {
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    if (error) return Response.json({ error: "通知登録を解除できませんでした。" }, { status: 503 });
  }
  return Response.json({ subscribed: false }, { headers: { "cache-control": "no-store" } });
}

export async function GET() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
