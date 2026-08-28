"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z" />
      <path fill="#34a853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#fbbc05" d="M6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.5H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.5l3.3-2.6Z" />
      <path fill="#ea4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6C7.2 7.8 9.4 6 12 6Z" />
    </svg>
  );
}

export default function LoginClient({ configured }: { configured: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!configured) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authError) {
      setError("Googleログインを開始できませんでした。少し待って再試行してください。");
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="Daily English Lens introduction">
        <div className="login-brand-lockup"><span className="brand-mark">D</span><strong>Daily English Lens</strong></div>
        <div>
          <p className="kicker">YOUR LIFE · YOUR ENGLISH</p>
          <h1>Turn your day<br />into English.</h1>
          <p>今日の写真から、自分が本当に使いたい英語を作る。保存した日記は、どの端末からでも続きを学べます。</p>
        </div>
        <div className="login-loop"><span>Life</span><b>→</b><span>English</span><b>→</b><span>Memory</span><b>→</b><span>Review</span></div>
      </section>

      <section className="login-action-panel">
        <div className="login-card">
          <span className="login-step">01</span>
          <p className="section-eyebrow">WELCOME</p>
          <h2>毎日の記録を、あなたのアカウントへ。</h2>
          <p>Googleアカウントでログインすると、写真・英語日記・復習データを安全に保存できます。</p>
          <button className="google-login" type="button" onClick={() => void signIn()} disabled={!configured || loading}>
            <GoogleMark />
            <span>{loading ? "Googleに接続中…" : "Googleで続ける"}</span>
            <b>→</b>
          </button>
          {!configured && <div className="login-error">Supabaseの接続設定がまだ完了していません。</div>}
          {error && <div className="login-error" role="alert">{error}</div>}
          <small>
            ログインすることで、写真と学習記録をアカウントに保存することに同意したものとみなされます。
            <a href="/privacy">プライバシーポリシー</a>
          </small>
        </div>
      </section>
    </main>
  );
}
