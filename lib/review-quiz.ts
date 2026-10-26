import type { DailyEntry, Expression } from "./daily-english";

export type ReviewItem = { entry: DailyEntry; expression: Expression };
export type ReviewGrade = "correct" | "almost" | "wrong";

export function reviewItemsForEntry(entry: DailyEntry): ReviewItem[] {
  return (entry.expressions ?? [])
    .filter((expression) => expression.id && expression.example?.trim() && expression.japanese?.trim())
    .map((expression) => ({ entry, expression }));
}

export function reviewItemKey(item: ReviewItem) {
  return `${item.entry.id}:${item.expression.id}`;
}

export function reviewJapanesePrompt(item: ReviewItem) {
  const japanese = item.expression.japanese;
  if (!/(?:_{2,}|＿{2,}|\[\s*\]|\(\s*\))/.test(japanese)) return japanese;
  return item.entry.moments?.find((moment) => moment.photoId === item.expression.photoId)?.japanese
    ?? item.entry.diaryJapanese
    ?? japanese;
}

export function reviewWordCount(item: ReviewItem) {
  return item.expression.example.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeReviewAnswer(value: string) {
  return value.trim().toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ");
}

export async function requestReviewGrade(
  clue: string,
  reference: string,
  answer: string,
  fetcher: typeof fetch = fetch,
): Promise<ReviewGrade> {
  let response: Response;
  try {
    response = await fetcher("/api/review/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clue, reference, answer }),
    });
  } catch {
    throw new Error("通信できませんでした。接続を確認して再試行してください。");
  }
  let body: { grade?: unknown; error?: unknown };
  try {
    body = await response.json() as typeof body;
  } catch {
    throw new Error("回答を判定できませんでした。もう一度お試しください。");
  }
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "回答を判定できませんでした。もう一度お試しください。");
  }
  if (body.grade !== "correct" && body.grade !== "almost" && body.grade !== "wrong") {
    throw new Error("回答を判定できませんでした。もう一度お試しください。");
  }
  return body.grade;
}
