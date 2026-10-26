import { handleReviewGradeRequest } from "../../../../lib/review-grader";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type BurstBucket = { count: number; resetAt: number };
const burstBuckets = (globalThis as typeof globalThis & {
  dailyEnglishLensReviewBuckets?: Map<string, BurstBucket>;
}).dailyEnglishLensReviewBuckets ?? new Map<string, BurstBucket>();

(globalThis as typeof globalThis & {
  dailyEnglishLensReviewBuckets?: Map<string, BurstBucket>;
}).dailyEnglishLensReviewBuckets = burstBuckets;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "ログイン機能の設定が完了していません。" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Googleアカウントでログインしてください。" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "production") {
    const now = Date.now();
    const current = burstBuckets.get(user.id);
    if (!current || current.resetAt <= now) {
      burstBuckets.set(user.id, { count: 1, resetAt: now + 10 * 60 * 1000 });
    } else if (current.count >= 30) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      return Response.json(
        { error: "短時間に回答を確認しすぎました。少し待って再試行してください。" },
        { status: 429, headers: { "retry-after": String(retryAfter), "cache-control": "no-store" } },
      );
    } else {
      current.count += 1;
    }
  }

  return handleReviewGradeRequest(
    request,
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_VISION_MODEL,
  );
}
