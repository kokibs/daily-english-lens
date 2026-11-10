import type { DailyEntry, PhotoEntry } from "./daily-english";

const DATABASE_NAME = "daily-english-lens-drafts";
const STORE_NAME = "drafts";

export type LocalDraft = {
  version: 1;
  photos: PhotoEntry[];
  selectedPhotoId: string | null;
  activeEntry: DailyEntry | null;
  screen: "home" | "today";
};

function isPhoto(value: unknown): value is PhotoEntry {
  if (!value || typeof value !== "object") return false;
  const photo = value as Partial<PhotoEntry>;
  return typeof photo.id === "string"
    && typeof photo.imageUrl === "string"
    && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(photo.imageUrl)
    && (photo.note === undefined || typeof photo.note === "string")
    && (photo.label === undefined || typeof photo.label === "string")
    && (photo.time === undefined || typeof photo.time === "string");
}

function isLocalDraft(value: unknown): value is LocalDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<LocalDraft>;
  const entry = draft.activeEntry;
  return draft.version === 1
    && Array.isArray(draft.photos)
    && draft.photos.length <= 10
    && draft.photos.every(isPhoto)
    && (draft.selectedPhotoId === null || typeof draft.selectedPhotoId === "string")
    && (draft.screen === "home" || draft.screen === "today")
    && (entry === null || !!entry
      && typeof entry.id === "string"
      && typeof entry.date === "string"
      && typeof entry.diaryEnglish === "string"
      && typeof entry.diaryJapanese === "string"
      && Array.isArray(entry.photos)
      && entry.photos.length <= 10
      && entry.photos.every(isPhoto)
      && Array.isArray(entry.moments)
      && entry.moments.every((moment) => moment && typeof moment.photoId === "string"
        && typeof moment.english === "string" && typeof moment.japanese === "string")
      && Array.isArray(entry.expressions)
      && entry.expressions.every((expression) => expression && typeof expression.id === "string"
        && typeof expression.expression === "string" && typeof expression.japanese === "string"
        && typeof expression.example === "string" && typeof expression.explanation === "string"));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error);
  });
}

async function writeDraft(userId: string, draft: LocalDraft | null): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      if (draft) store.put(draft, userId);
      else store.delete(userId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

type PendingWrite = {
  draft: LocalDraft | null;
  listeners: { resolve: () => void; reject: (error: unknown) => void }[];
};

const pendingWrites = new Map<string, PendingWrite>();
let draining: Promise<void> | null = null;

async function drainWrites() {
  while (pendingWrites.size) {
    const [userId, pending] = pendingWrites.entries().next().value as [string, PendingWrite];
    pendingWrites.delete(userId);
    try {
      await writeDraft(userId, pending.draft);
      pending.listeners.forEach(({ resolve }) => resolve());
    } catch (error) {
      pending.listeners.forEach(({ reject }) => reject(error));
    }
  }
}

export function replaceLocalDraft(userId: string, draft: LocalDraft | null): Promise<void> {
  const result = new Promise<void>((resolve, reject) => {
    const pending = pendingWrites.get(userId);
    if (pending) {
      pending.draft = draft;
      pending.listeners.push({ resolve, reject });
    } else {
      pendingWrites.set(userId, { draft, listeners: [{ resolve, reject }] });
    }
  });
  if (!draining) draining = drainWrites().finally(() => { draining = null; });
  return result;
}

export async function loadLocalDraft(userId: string): Promise<LocalDraft | null> {
  if (draining) await draining;
  const database = await openDatabase();
  try {
    const stored = await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return isLocalDraft(stored) ? stored : null;
  } finally {
    database.close();
  }
}
