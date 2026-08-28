import type { DailyEntry, Expression, MomentSentence, PhotoEntry } from "./daily-english";
import { createClient } from "./supabase/client";

const PHOTO_BUCKET = "daily-photos";
const SIGNED_URL_LIFETIME_SECONDS = 24 * 60 * 60;

type StoredPhoto = Omit<PhotoEntry, "imageUrl"> & {
  storagePath: string;
};

type DailyEntryRow = {
  id: string;
  entry_date: string;
  diary_english: string;
  diary_japanese: string;
  photos: StoredPhoto[];
  moments: MomentSentence[];
  expressions: Expression[];
};

function dataUrlToBlob(dataUrl: string) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("保存できない画像形式です。");
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

function safePathPart(value: string) {
  const safe = value.normalize("NFKD").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 80) || "photo";
}

function extensionFor(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function isStoredPhoto(value: unknown): value is StoredPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Partial<StoredPhoto>;
  return typeof photo.id === "string" && typeof photo.storagePath === "string";
}

async function uploadPhoto(userId: string, date: string, photo: PhotoEntry): Promise<StoredPhoto> {
  if (photo.storagePath && !photo.imageUrl.startsWith("data:")) {
    return {
      id: photo.id,
      note: photo.note,
      label: photo.label,
      time: photo.time,
      storagePath: photo.storagePath,
    };
  }

  const blob = dataUrlToBlob(photo.imageUrl);
  const storagePath = `${userId}/${date}/${safePathPart(photo.id)}.${extensionFor(blob.type)}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(storagePath, blob, {
    contentType: blob.type,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error(`写真を保存できませんでした: ${error.message}`);

  return {
    id: photo.id,
    note: photo.note,
    label: photo.label,
    time: photo.time,
    storagePath,
  };
}

async function signedPhotoUrls(paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_LIFETIME_SECONDS);
  if (error) throw new Error(`写真を読み込めませんでした: ${error.message}`);

  const urls = new Map<string, string>();
  data.forEach((item, index) => {
    if (item.signedUrl) urls.set(paths[index], item.signedUrl);
  });
  return urls;
}

function parseRows(value: unknown): DailyEntryRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is DailyEntryRow => {
    if (!row || typeof row !== "object") return false;
    const candidate = row as Partial<DailyEntryRow>;
    return typeof candidate.id === "string"
      && typeof candidate.entry_date === "string"
      && typeof candidate.diary_english === "string"
      && typeof candidate.diary_japanese === "string"
      && Array.isArray(candidate.photos)
      && candidate.photos.every(isStoredPhoto)
      && Array.isArray(candidate.moments)
      && Array.isArray(candidate.expressions);
  });
}

export async function loadDailyEntries(): Promise<DailyEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_entries")
    .select("id, entry_date, diary_english, diary_japanese, photos, moments, expressions")
    .order("entry_date", { ascending: false });
  if (error) throw new Error(`日記を読み込めませんでした: ${error.message}`);

  const rows = parseRows(data);
  const paths = [...new Set(rows.flatMap((row) => row.photos.map((photo) => photo.storagePath)))];
  const urls = await signedPhotoUrls(paths);

  return rows.map((row) => ({
    id: row.id,
    date: row.entry_date,
    diaryEnglish: row.diary_english,
    diaryJapanese: row.diary_japanese,
    photos: row.photos.map((photo) => ({
      ...photo,
      imageUrl: urls.get(photo.storagePath) ?? "",
    })),
    moments: row.moments,
    expressions: row.expressions,
  }));
}

export async function saveDailyEntry(userId: string, entry: DailyEntry): Promise<DailyEntry> {
  const supabase = createClient();
  const { data: previous } = await supabase
    .from("daily_entries")
    .select("photos")
    .eq("user_id", userId)
    .eq("entry_date", entry.date)
    .maybeSingle();

  const storedPhotos = await Promise.all(entry.photos.map((photo) => uploadPhoto(userId, entry.date, photo)));
  const { data, error } = await supabase
    .from("daily_entries")
    .upsert({
      user_id: userId,
      entry_date: entry.date,
      diary_english: entry.diaryEnglish,
      diary_japanese: entry.diaryJapanese,
      photos: storedPhotos,
      moments: entry.moments,
      expressions: entry.expressions,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,entry_date" })
    .select("id")
    .single();
  if (error) throw new Error(`日記を保存できませんでした: ${error.message}`);

  const previousPhotos = Array.isArray(previous?.photos)
    ? previous.photos.filter(isStoredPhoto)
    : [];
  const currentPaths = new Set(storedPhotos.map((photo) => photo.storagePath));
  const stalePaths = previousPhotos
    .map((photo) => photo.storagePath)
    .filter((path) => !currentPaths.has(path));
  if (stalePaths.length) {
    // The database already points at the new files, so a cleanup failure should
    // not make a successfully saved diary appear to have failed.
    await supabase.storage.from(PHOTO_BUCKET).remove(stalePaths);
  }

  return {
    ...entry,
    id: data.id,
    photos: entry.photos.map((photo, index) => ({
      ...photo,
      storagePath: storedPhotos[index].storagePath,
    })),
  };
}
