import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="configuration-page">
      <div className="configuration-card">
        <span className="brand-mark">D</span>
        <p className="kicker">SIGN IN ERROR</p>
        <h1>ログインを完了できませんでした。</h1>
        <p>もう一度Googleログインをお試しください。</p>
        <Link className="configuration-link" href="/login">ログイン画面へ戻る →</Link>
      </div>
    </main>
  );
}
