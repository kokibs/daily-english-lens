"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "off" | "on" | "busy" | "unsupported";

function supported() {
  return typeof window !== "undefined" && window.isSecureContext
    && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (letter) => letter.charCodeAt(0)).buffer;
}

async function sendSubscription(method: "POST" | "DELETE", subscription: PushSubscription, statusOnly = false) {
  const response = await fetch("/api/push/subscriptions", {
    method,
    headers: { "content-type": "application/json", ...(statusOnly ? { "x-push-status": "1" } : {}) },
    body: JSON.stringify(subscription.toJSON()),
  });
  const body = await response.json() as { subscribed?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || "通知設定を変更できませんでした。");
  return body;
}

export async function unsubscribeBrowserPush() {
  if (!supported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try { await sendSubscription("DELETE", subscription); } finally { await subscription.unsubscribe(); }
}

export default function PushNotificationSettings({ testMonth }: { testMonth: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!supported() || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        const registered = subscription ? (await sendSubscription("POST", subscription, true)).subscribed : false;
        if (!cancelled) setStatus(registered ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("off");
      }
    }
    void check();
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    if (!supported()) return;
    setStatus("busy");
    setMessage("ブラウザの通知許可を確認してください。");
    try {
      // Safari requires the permission request to follow the user's tap directly.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("off");
        setMessage("通知が許可されていません。端末の通知設定を確認してください。");
        return;
      }
      setMessage("");
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("通知の設定が完了していません。");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const registered = await sendSubscription("POST", subscription, true);
        if (registered.subscribed) {
          setStatus("on");
          return;
        }
        await subscription.unsubscribe();
      }
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(key) });
      try { await sendSubscription("POST", subscription); }
      catch (error) { await subscription.unsubscribe(); throw error; }
      setStatus("on");
      setMessage("月初に先月のアルバムをお知らせします。");
    } catch (error) {
      setStatus("off");
      setMessage(error instanceof Error ? error.message : "通知を有効にできませんでした。");
    }
  }

  async function disable() {
    setStatus("busy");
    setMessage("");
    try {
      await unsubscribeBrowserPush();
      setStatus("off");
      setMessage("この端末への通知を停止しました。");
    } catch (error) {
      setStatus("off");
      setMessage(error instanceof Error ? error.message : "通知設定を変更できませんでした。");
    }
  }

  async function test() {
    if (!testMonth) return;
    setMessage("");
    try {
      const response = await fetch("/api/push/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month: testMonth }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "テスト通知を送れませんでした。");
      setMessage("テスト通知を送りました。端末の通知欄を確認してください。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "テスト通知を送れませんでした。");
    }
  }

  const needsHomeScreen = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)
    && !window.matchMedia("(display-mode: standalone)").matches;

  return <aside className="album-push-settings">
    <div><span className="kicker">MONTHLY REMINDER</span><h2>思い出の通知</h2><p>前月に保存した写真と英語を、月初にこの端末へお知らせします。</p>
      {needsHomeScreen && <p>iPhoneでは、共有メニューから「ホーム画面に追加」して、追加したアプリで通知を有効にしてください。</p>}
      {status === "unsupported" && <p>このブラウザでは通知を利用できません。iPhoneはホーム画面に追加したアプリからお試しください。</p>}
      {message && <p className="album-push-message" role="status">{message}</p>}
    </div>
    <div className="album-push-actions">
      {status === "on" ? <button type="button" onClick={() => void disable()}>通知をオフにする</button>
        : <button type="button" disabled={status !== "off" || needsHomeScreen} onClick={() => void enable()}>{status === "busy" || status === "checking" ? "確認中…" : "この端末で通知を受け取る"}</button>}
      {process.env.NODE_ENV === "development" && status === "on" && testMonth && <button type="button" onClick={() => void test()}>端末通知を試す</button>}
    </div>
  </aside>;
}
