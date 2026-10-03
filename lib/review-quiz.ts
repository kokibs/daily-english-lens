import type { DailyEntry, Expression } from "./daily-english";

export type ReviewItem = { entry: DailyEntry; expression: Expression };

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
