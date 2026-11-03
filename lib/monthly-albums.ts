import type { DailyEntry, PhotoEntry } from "./daily-english";

export type MonthlyAlbum = {
  month: string;
  entries: DailyEntry[];
  photos: PhotoEntry[];
};

export type AlbumStoryFrame = {
  id: string;
  date: string;
  photo: PhotoEntry;
  english: string;
  japanese: string;
};

const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function monthlyAlbums(entries: DailyEntry[]): MonthlyAlbum[] {
  const grouped = new Map<string, DailyEntry[]>();
  for (const entry of entries) {
    const match = DATE_PATTERN.exec(entry.date);
    if (!match) continue;
    const month = `${match[1]}-${match[2]}`;
    grouped.set(month, [...(grouped.get(month) ?? []), entry]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([month, days]) => {
      const sorted = [...days].sort((left, right) => right.date.localeCompare(left.date));
      return { month, entries: sorted, photos: sorted.flatMap((entry) => entry.photos) };
    });
}

export function albumStoryFrames(album: MonthlyAlbum): AlbumStoryFrame[] {
  return [...album.entries]
    .sort((left, right) => left.date.localeCompare(right.date))
    .flatMap((entry) => entry.photos.map((photo, index) => {
      const moment = entry.moments?.find((item) => item.photoId === photo.id);
      const expression = entry.expressions?.find((item) => item.photoId === photo.id);
      return {
        id: `${entry.id}:${photo.id}:${index}`,
        date: entry.date,
        photo,
        english: moment?.english?.trim() || expression?.example?.trim() || entry.diaryEnglish?.trim() || "",
        japanese: moment?.japanese?.trim() || expression?.japanese?.trim() || entry.diaryJapanese?.trim() || "",
      };
    }));
}

export function albumMonthLabel(month: string, locale = "ja-JP") {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return month;
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", timeZone: "Asia/Tokyo" })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

export function previousMonthKey(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function albumReadyForNotification(albums: MonthlyAlbum[], now: Date) {
  const month = previousMonthKey(now);
  return albums.find((album) => album.month === month) ?? null;
}
