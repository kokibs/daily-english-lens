# Daily English Lens

**Turn your day into English. — あなたの一日を、英語にしよう。**

[公開中のアプリを開く](https://daily-english-lens.vercel.app/)

Daily English Lensは、1日の写真と思い出を自分だけの英語教材へ変える、モバイルファーストのWebアプリです。写真に写った物の名前を答えるだけではなく、その写真の背景にある体験を英語で表現します。

## コンセプト

一般的な英語教材で学ぶのは、誰かが選んだ単語や例文です。

Daily English Lensは、自分自身の体験から英語を学べる教材を作ります。

混雑した電車の写真は **The train was packed.** に、練習後の写真は **I was worn out after practice.** になります。実際の記憶と英語表現が結びつくため、覚えやすく、日常会話でも自分の出来事を話せるようになります。

学習の流れは次のとおりです。

**Life → English → Memory → Review**

## 解決したい課題

英単語を知っていても、「今日、自分に何があったか」を英語で話すのは簡単ではありません。Daily English Lensは「この瞬間を友達に話すなら、英語でどう表現するか？」という、自分に近い問いから学習を始めます。

アプリは最初から用意された教材を表示せず、ユーザーが追加した写真だけを使います。毎日の出来事を英語日記、会話表現、翌日の復習へつなげ、就寝前などに約3分で続けられる学習体験を目指しています。

## 主な機能

- ホーム画面から写真の追加・削除・並べ替え・補足入力
- ファイル選択またはドラッグ＆ドロップで、1日最大10枚まで追加
- 写真そのものと任意の補足文をAIが一緒に解析
- 各写真の出来事に基づく英文と日本語訳を生成
- 1日をまとめた英語日記と、会話で使える表現を最大6件生成
- Googleアカウントでログインし、写真と日記をユーザーごとに保存
- ブラウザや端末を変えても、保存した日記と復習データを復元
- 写真と、その写真から生成された英文を1対1で表示
- 入門・初級・中級・上級を選んで、今後生成する英文の語彙・自然な言い回し・ニュアンスを調整。入門・初級の復習には単語ヒントを表示（設定はこのブラウザに保存）
- 表現スタイルは日常会話を初期値とし、生成画面の詳細設定からSNS・カジュアル／丁寧な表現にも変更可能（このブラウザに保存、保存済みの英文は変更しない）
- 固定のAI音声による日記の読み上げ（再生した音声はこの端末に保存し、同じ日記の再生に再利用）
- ホーム画面の1問復習と、日付を選んでその日だけを学べるReview画面（1周ごとの結果・全問再挑戦・間違えた問題だけの再挑戦に対応）
- 復習では例文と同じ表現でなくても、意味の通る言い換えをAIが正解として判定
- 復習問題では写真に写る場所・食べ物・活動などの具体的な名詞を日本語のヒントに残し、覚える英語表現だけを穴埋めで出題
- 正解時の効果音と、保存されるサウンド設定
- 保存した写真・英語日記・写真ごとの英文を月別アルバムで振り返る機能。写真と対応する英文・日本語訳を日付順に再生する思い出ムービーもあり、翌月の案内やWeb Push通知から開ける
- 保存した日の写真・日記・復習データを本人が削除できる機能
- スマートフォン、タブレット、PCに対応したレスポンシブデザイン

ローカルの開発画面では、アルバム一覧の「通知を試す」から画面内のお知らせをプレビューできます。「この端末で通知を受け取る」を押して許可すると、保存済みの月がある場合に「端末通知を試す」でWeb Pushもテストできます。

## 月別アルバムの端末通知

1. `.env.local`に`NEXT_PUBLIC_VAPID_PUBLIC_KEY`と`VAPID_PRIVATE_KEY`を設定します。VAPID鍵は`web-push`の`generate-vapid-keys`で一組だけ作り、秘密鍵をGitへ登録しません。
2. 公開時は`supabase/migrations/202611020001_monthly_album_push.sql`をSupabaseに適用します。これは通知先の登録表だけを追加します。開発環境では通知先を一時的にメモリへ保存するため、このSQLを適用せずテストできます。
3. VercelのProduction環境に同じVAPID鍵、`SUPABASE_SECRET_KEY`、任意に生成した`CRON_SECRET`を設定します。Secret Keyはサーバー側でのみ使用します。`vercel.json`の月初の定期処理が、前月に日記を保存した人へ通知を送ります。1〜3日の午前9時ごろ（日本時間）に再試行し、同じ月に二重送信しないよう記録します。
4. iPhoneではSafariからサイトをホーム画面へ追加し、そのアイコンから開いて通知を許可します。端末の設定で通知が無効なら届きません。PC/Androidでも対応ブラウザで許可が必要です。

通知には写真や日記本文を含めず、月だけを送ります。通知をタップすると該当月の思い出ムービーが自動再生されます。アルバム詳細からも再生・一時停止・前後移動ができます。ムービーはアプリ内で再生するもので、動画ファイルは作成しません。ログアウト時にはこの端末の通知登録を解除します。閉じた端末への通知は、公開環境の設定と実機での確認が必要です。

## ローカルでの起動方法

必要環境：Node.js 22.13以上

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

写真から英文を生成する前に、ローカルの`.env.local`へ次の環境変数を設定します。

```bash
OPENAI_API_KEY=your_api_key
# 任意。未設定の場合は、以下の画像対応モデルを使用します。
OPENAI_VISION_MODEL=gpt-5.6-luna
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

本番用ビルドは次のコマンドで確認できます。

```bash
npm run build
```

## 写真解析と英文生成

ブラウザ側のAI呼び出し境界は`lib/daily-english.ts`にあります。

```ts
generateDailyEnglish(photos: PhotoEntry[]): Promise<DailyEntry>
```

ブラウザは、10枚の写真を送ってもVercelのリクエスト上限を超えないよう画像を縮小します。「Generate」を押したときだけ、同一オリジンの`/api/generate`へ写真と補足文を送信します。認証済みのNext.js Route Handlerが、画像入力と厳密なJSON Schemaを使ってOpenAI Responses APIを呼び出します。APIキーはサーバー側だけで管理します。

- `lib/daily-english.ts`：ブラウザ側の生成処理とデータ型
- `lib/vision-generator.ts`：入力検証、写真と補足文の送信、生成結果の検証、穴埋め問題の作成
- `app/api/generate/route.ts`：APIキーをサーバー側で保持する生成エンドポイント
- `app/api/review/check/route.ts`：ログインを確認し、英文の意味をサーバー側で判定する復習エンドポイント。例文と完全一致する回答はAIを呼ばずに正解とし、判定エラーは誤答にせず再試行できます
- `app/api/narrate/route.ts`：ログインを確認し、サーバー側のAPIキーで日記のAI音声を生成するエンドポイント
- `lib/narration-audio.ts`・`lib/narration-text.ts`：固定の声による音声生成と、`11 p.m.`などの時刻を自然に読むための変換
- 生成に失敗した場合はエラーを表示し、チュートリアル文や汎用文へ勝手に置き換えません

日記データはSupabase Postgres、写真は非公開の`daily-photos`バケットへ保存します。Row Level Securityにより、ログインした本人だけが自分のデータを読み書きできます。以前の`localStorage`に日記が残っている場合は、Googleログイン後に一度だけクラウドへ移行し、端末から削除します。

英語レベルの選択はユーザーごとにこのブラウザの`localStorage`へ保存します。変更後に新しく生成する英文と復習画面のヒントに反映され、すでに保存した英文は書き換えません。

## SupabaseとGoogleログインの設定

1. Supabaseプロジェクトを作成し、SQL Editorで`supabase/migrations/202608290001_google_auth_and_cloud_entries.sql`を実行します。
2. Google Auth PlatformでWebアプリケーション用のOAuthクライアントを作成します。
3. SupabaseのGoogle Provider画面に表示されるコールバックURLを、Google側の承認済みリダイレクトURIへ追加します。
4. Supabase AuthenticationでGoogle Providerを有効にし、Client IDとClient Secretを設定します。
5. SupabaseのSite URLを本番ドメインに設定し、`http://localhost:3000/auth/callback`と本番URLの`/auth/callback`をリダイレクト許可リストへ追加します。
6. プロジェクトURLとPublishable Keyを`.env.local`およびVercelのProduction・Preview環境へ設定します。

`NEXT_PUBLIC_`を付けるのは公開可能なPublishable Keyだけです。SupabaseのService Role KeyやGoogle Client Secretをブラウザへ公開しないでください。

## データ構造

```ts
type DailyEntry = {
  id: string;
  date: string;
  photos: PhotoEntry[];
  diaryEnglish: string;
  diaryJapanese: string;
  expressions: Expression[];
};
```

## Vercelへのデプロイ

1. リポジトリをGitHubへPushし、Vercel DashboardからImportします。
2. Framework Presetを`Next.js`に設定します。
3. `OPENAI_API_KEY`をProduction・Previewのサーバー用環境変数として追加します。
4. `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`、`NEXT_PUBLIC_SITE_URL`をProduction・Previewへ追加します。
5. 必要に応じて`OPENAI_VISION_MODEL`を追加します。未設定の場合は`gpt-5.6-luna`を使用します。
6. Vercel Firewallで`/api/generate`にIPごとに10分間5回のRate Limitルールを設定します。復習の`/api/review/check`にも適切なRate Limitを設定してください（アプリ内の短時間制限はサーバーインスタンス単位です）。
7. デプロイ後、シークレットウィンドウとスマートフォンでGoogleログイン、クラウド復元、写真からの生成を確認します。

`OPENAI_API_KEY`に`NEXT_PUBLIC_`を付けないでください。付けるとAPIキーがブラウザへ公開されます。

## 使用技術

- React 19 + TypeScript
- Next.js App Router
- Tailwind CSS 4
- CSSアニメーションとレスポンシブレイアウト
- OpenAI Responses API
- Supabase Auth、Postgres、非公開Storage
- OpenAI Realtime APIによるAI音声、Web Audio API
- Vercel
- `localStorage`（サウンド設定と旧データの移行のみ）
