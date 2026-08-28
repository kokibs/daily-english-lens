import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Daily English Lens",
  description: "Daily English Lensにおけるデータの取り扱いについて説明します。",
};

const sections = [
  {
    title: "1. 取得する情報",
    body: "Googleログインから提供される氏名・メールアドレス・プロフィール画像、ユーザーが追加する写真と補足文、生成された英語日記・日本語訳・復習記録、サービスの利用に必要な端末内設定を取り扱います。",
  },
  {
    title: "2. 利用目的",
    body: "写真と補足文から英語学習コンテンツを生成し、日付ごとの日記や復習状況を本人のアカウントに保存するために利用します。不正利用の防止、障害対応、サービス品質の改善にも必要な範囲で利用します。",
  },
  {
    title: "3. 外部サービスへの送信",
    body: "英文生成時には、選択した写真と補足文をOpenAI APIへ送信します。ログインとデータ保存にはGoogle OAuthおよびSupabaseを利用します。各サービスでの取り扱いには、それぞれの提供者の規約とプライバシーポリシーが適用されます。",
  },
  {
    title: "4. 保存と安全管理",
    body: "写真と学習記録はSupabase上に保存し、ログインした本人だけが読み書きできるアクセス制御を設定しています。認証情報やAPIキーをブラウザへ公開しない構成にしています。",
  },
  {
    title: "5. 削除・お問い合わせ",
    body: "保存データの削除を希望する場合は、Googleログイン画面に表示されるユーザーサポート窓口へご連絡ください。本人確認後、合理的な期間内に対応します。",
  },
];

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="legal-brand" href="/login">
          <span className="brand-mark">D</span>
          <strong>Daily English Lens</strong>
        </Link>
      </header>

      <article className="legal-card">
        <p className="section-eyebrow">PRIVACY</p>
        <h1>プライバシーポリシー</h1>
        <p className="legal-lead">
          Daily English Lensは、あなたの写真と思い出を英語学習に変えるため、必要な情報だけを取り扱います。
        </p>
        <p className="legal-updated">制定日：2026年8月29日</p>

        <div className="legal-sections">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>

        <footer className="legal-footer">
          <Link href="/login">ログイン画面へ戻る</Link>
        </footer>
      </article>
    </main>
  );
}
