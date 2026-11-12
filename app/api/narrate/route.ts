import { createHash } from "node:crypto";
import { generateNarrationAudio } from "../../../lib/narration-audio";
import { isSupabaseConfigured } from "../../../lib/supabase/config";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RateBucket = { count: number; resetAt: number };
const rateBuckets = (globalThis as typeof globalThis & { narrationRateBuckets?: Map<string, RateBucket> })
  .narrationRateBuckets ?? new Map<string, RateBucket>();
(globalThis as typeof globalThis & { narrationRateBuckets?: Map<string, RateBucket> }).narrationRateBuckets = rateBuckets;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "ログイン機能の設定が完了していません。" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "ログインしてください。" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "音声機能の設定が完了していません。" }, { status: 503 });
  }

  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return Response.json({ error: "英文を読み取れませんでした。" }, { status: 400 });
  }
  if (typeof text !== "string" || !text.trim() || text.length > 1_600) {
    return Response.json({ error: "読み上げる英文が長すぎるか、空です。" }, { status: 400 });
  }

  const now = Date.now();
  const current = rateBuckets.get(user.id);
  if (current && current.resetAt > now && current.count >= 10) {
    return Response.json({ error: "音声の生成回数が短時間の上限に達しました。少し待ってから試してください。" }, { status: 429 });
  }
  rateBuckets.set(user.id, current && current.resetAt > now
    ? { ...current, count: current.count + 1 }
    : { count: 1, resetAt: now + 10 * 60_000 });

  try {
    const safetyId = createHash("sha256").update(user.id).digest("hex");
    const audio = await generateNarrationAudio(text.trim(), process.env.OPENAI_API_KEY, safetyId, request.signal);
    return new Response(new Uint8Array(audio), {
      headers: { "content-type": "audio/wav", "cache-control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "音声を生成できませんでした。";
    return Response.json({ error: message }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
