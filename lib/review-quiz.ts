import type { DailyEntry, MomentSentence } from "./daily-english";

export type ReviewItem = { entry: DailyEntry; moment: MomentSentence };

export function reviewItemsForEntry(entry: DailyEntry): ReviewItem[] {
  const momentsByPhotoId = new Map(
    (entry.moments ?? [])
      .filter((moment) => moment.photoId && moment.english?.trim() && moment.japanese?.trim())
      .map((moment) => [moment.photoId, moment]),
  );

  return entry.photos.flatMap((photo) => {
    const moment = momentsByPhotoId.get(photo.id);
    return moment ? [{ entry, moment }] : [];
  });
}

export function reviewItemKey(item: ReviewItem) {
  return `${item.entry.id}:${item.moment.photoId}`;
}

export function normalizeReviewAnswer(value: string) {
  return value.trim().toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ");
}
