const CACHE_NAME = "daily-english-lens-narration-marin-v1";

async function cacheRequest(userId: string, entryId: string, text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request(`${location.origin}/__narration-cache/${encodeURIComponent(userId)}/${encodeURIComponent(entryId)}/${hash}`);
}

async function openCache() {
  if (!("caches" in window) || typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

export async function loadNarrationAudio(userId: string, entryId: string, text: string, signal: AbortSignal) {
  const cache = await openCache();
  const key = cache ? await cacheRequest(userId, entryId, text) : null;
  if (cache && key) {
    try {
      const cached = await cache.match(key);
      if (cached) return cached.blob();
    } catch {
      // Playback can proceed without a persistent cache.
    }
  }

  const response = await fetch("/api/narrate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(typeof result.error === "string" ? result.error : "音声を読み込めませんでした。");
  }
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith("audio/")) throw new Error("音声を読み込めませんでした。");

  if (cache && key && !signal.aborted) {
    try {
      await cache.put(key, new Response(blob, { headers: { "content-type": "audio/wav" } }));
      const keys = await cache.keys();
      for (const oldKey of keys.slice(0, -20)) await cache.delete(oldKey);
    } catch {
      // Private browsing may disallow storage; playback can still continue.
    }
  }
  return blob;
}

export async function deleteCachedNarration(userId: string, entryId: string) {
  const cache = await openCache();
  if (!cache) return;
  const prefix = `${location.origin}/__narration-cache/${encodeURIComponent(userId)}/${encodeURIComponent(entryId)}/`;
  for (const key of await cache.keys()) {
    if (key.url.startsWith(prefix)) await cache.delete(key);
  }
}
