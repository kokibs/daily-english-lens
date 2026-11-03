/* Daily English Lens notifications. No pages or photos are cached here. */
self.addEventListener("push", (event) => {
  let message;
  try {
    message = event.data?.json();
  } catch {
    return;
  }
  if (message?.type !== "monthly-album" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(message.month)) return;

  event.waitUntil(self.registration.showNotification(`${message.month.slice(0, 4)}年${Number(message.month.slice(5))}月のアルバムができました`, {
    body: "写真と英文の思い出ムービーを再生しよう。",
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    tag: `monthly-album-${message.month}`,
    data: { month: message.month },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const month = event.notification.data?.month;
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
  const url = new URL("/", self.location.origin);
  url.searchParams.set("album", month);
  url.searchParams.set("play", "1");

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.navigate(url.href);
      return existing.focus();
    }
    return self.clients.openWindow(url.href);
  })());
});
