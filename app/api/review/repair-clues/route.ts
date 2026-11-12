import { translateLegacyReviewClues } from "../../../../lib/review-clue-repair";
import type { Expression } from "../../../../lib/daily-english";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: "ログイン機能を利用できません。" }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Googleアカウントでログインしてください。" }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 256) {
    return Response.json({ error: "日付を確認してください。" }, { status: 413 });
  }

  let date: unknown;
  try {
    const body = await request.text();
    if (body.length > 256) throw new Error("Invalid body");
    date = (JSON.parse(body) as { date?: unknown }).date;
  } catch {
    return Response.json({ error: "日付を確認してください。" }, { status: 400 });
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "日付を確認してください。" }, { status: 400 });
  }

  const { data: row, error: readError } = await supabase.from("daily_entries")
    .select("id, expressions")
    .eq("user_id", user.id)
    .eq("entry_date", date)
    .maybeSingle();
  if (readError || !row) return Response.json({ error: "この日の復習問題を読み込めませんでした。" }, { status: 404 });
  const expressions = row.expressions as Expression[];
  if (!Array.isArray(expressions)) return Response.json({ error: "復習問題を読み込めませんでした。" }, { status: 422 });
  const missing = expressions.filter((item) => item.example?.trim() && !item.exampleJapanese?.trim());
  if (!missing.length) return Response.json({ expressions }, { headers: { "cache-control": "no-store" } });
  if (missing.length > 6 || !process.env.OPENAI_API_KEY) {
    return Response.json({ error: "復習問題を準備できませんでした。" }, { status: 503 });
  }
  try {
    const clues = await translateLegacyReviewClues(missing, process.env.OPENAI_API_KEY, process.env.OPENAI_VISION_MODEL);
    const repaired = expressions.map((item) => clues.has(item.id)
      ? { ...item, exampleJapanese: clues.get(item.id) }
      : item);
    const { error: updateError } = await supabase.from("daily_entries")
      .update({ expressions: repaired, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("user_id", user.id);
    if (updateError) throw updateError;
    return Response.json({ expressions: repaired }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Daily English Lens review clue repair failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "日本語の問題文を準備できませんでした。もう一度お試しください。" }, { status: 502 });
  }
}
