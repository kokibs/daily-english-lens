import { devPushSubscriptionsForUser, removeDevPushSubscription } from "../../../../lib/push-dev-store";
import { monthBounds } from "../../../../lib/push-notifications";
import { isGonePushEndpoint, isPushConfigured, sendAlbumPush } from "../../../../lib/push-server";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

const lastTestByUser = new Map<string, number>();

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return Response.json({ error: "Not found" }, { status: 404 });
  if (!isPushConfigured()) return Response.json({ error: "通知の設定が完了していません。" }, { status: 503 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "このサイトから操作してください。" }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "ログインしてください。" }, { status: 401 });
  if ((lastTestByUser.get(user.id) ?? 0) > Date.now() - 15_000) {
    return Response.json({ error: "少し待ってから通知を試してください。" }, { status: 429 });
  }
  lastTestByUser.set(user.id, Date.now());

  let month: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 100) throw new Error("Invalid body");
    month = (JSON.parse(raw) as { month?: unknown }).month;
    monthBounds(String(month));
  } catch {
    return Response.json({ error: "アルバムの月を選んでください。" }, { status: 400 });
  }

  const subscriptions = devPushSubscriptionsForUser(user.id);
  if (!subscriptions.length) return Response.json({ error: "まず通知を有効にしてください。" }, { status: 400 });

  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await sendAlbumPush(subscription, String(month));
      sent += 1;
    } catch (error) {
      if (isGonePushEndpoint(error)) removeDevPushSubscription(user.id, subscription.endpoint);
    }
  }
  return sent
    ? Response.json({ sent })
    : Response.json({ error: "通知を送れませんでした。登録し直して試してください。" }, { status: 502 });
}
