import { handleVisionGenerateRequest } from "../../../lib/vision-generator";
import { isSupabaseConfigured } from "../../../lib/supabase/config";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type BurstBucket = { count: number; resetAt: number };

const burstBuckets = (globalThis as typeof globalThis & {
  dailyEnglishLensBurstBuckets?: Map<string, BurstBucket>;
}).dailyEnglishLensBurstBuckets ?? new Map<string, BurstBucket>();

(globalThis as typeof globalThis & {
  dailyEnglishLensBurstBuckets?: Map<string, BurstBucket>;
}).dailyEnglishLensBurstBuckets = burstBuckets;

function sourceKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("x-real-ip")
    ?? forwarded
    ?? request.headers.get("user-agent")?.slice(0, 160)
    ?? "unknown";
}

function checkBurstLimit(request: Request, userId: string) {
  if (process.env.NODE_ENV !== "production") return null;
  const now = Date.now();
  const key = `${userId}:${sourceKey(request)}`;
  const current = burstBuckets.get(key);
  if (!current || current.resetAt <= now) {
    burstBuckets.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return null;
  }
  if (current.count >= 5) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return Response.json(
      { error: "短時間の生成回数が上限に達しました。10分ほど待ってから試してください。" },
      { status: 429, headers: { "retry-after": String(retryAfter), "cache-control": "no-store" } },
    );
  }
  current.count += 1;
  return null;
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "ログイン機能の設定が完了していません。" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Googleアカウントでログインしてください。" }, {
      status: 401,
      headers: { "cache-control": "no-store" },
    });
  }

  const limited = checkBurstLimit(request, user.id);
  if (limited) return limited;
  return handleVisionGenerateRequest(
    request,
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_VISION_MODEL,
  );
}
