# Daily English Lens

**Turn your day into English.**

Daily English Lens is a mobile-first web app prototype that turns the photos and moments from a user’s day into personal English-learning material. Instead of labeling objects in a photo, it finds useful language for the experience behind the photo.

## Concept

Traditional vocabulary apps teach you words chosen by someone else.  
Daily English Lens turns your own experiences into English learning material.

A crowded train becomes **The train was packed.** A photo after practice becomes **I was worn out after practice.** Because each expression is attached to a real memory, it has a reason to stick.

The core loop is:

**Life → English → Memory → Review**

## Why this exists

Most learners know many isolated words but struggle to say what happened to them today. Daily English Lens starts with a question that is easier and more personal: “What would you tell a friend about this moment?”

The prototype is designed to make that idea understandable in the first few seconds of a contest demo. It starts empty and uses only the photos a user adds.

## Main features

- Add, remove, reorder, and annotate photos directly from the home dashboard
- Upload up to ten photos with drag-and-drop or a file picker
- Analyze the actual photo together with its optional note using a Vision-capable model
- Generate a short bilingual diary grounded in each visible moment
- Learn up to six conversational expressions tied back to individual photos
- Sign in with Google and keep daily entries in a private Supabase account
- Restore photos, diaries, and review material across browsers and devices
- See each photo paired with the English sentence it generated
- Listen to the generated English diary with the device's built-in English voice
- Answer a one-question review directly on Home, or open the full review flow
- Hear a lightweight success chime after a correct review answer, with a persistent sound toggle
- Browse saved days in a visual photo archive
- Responsive layouts for phones, tablets, and desktop screens

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Add a local `.env.local` file before generating from photos:

```bash
OPENAI_API_KEY=your_api_key
# Optional; defaults to the cost-efficient vision model below.
OPENAI_VISION_MODEL=gpt-5.6-luna
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

For a production build:

```bash
npm run build
```

## Vision generation

The browser-side AI boundary lives in `lib/daily-english.ts`:

```ts
generateDailyEnglish(photos: PhotoEntry[]): Promise<DailyEntry>
```

The browser resizes photos so a ten-photo request remains below Vercel's request limit, then sends them to the same-origin `/api/generate` endpoint only when the user presses Generate. The authenticated Next.js route calls the OpenAI Responses API with image inputs and a strict JSON schema; the API key remains server-side.

- `lib/daily-english.ts` owns the client boundary and local data model.
- `lib/vision-generator.ts` validates requests, sends each image and note to the model, validates the structured result, and builds review cloze prompts.
- `app/api/generate/route.ts` keeps the key in the hosted runtime, exposes the same-origin endpoint, and adds a production burst limit.
- Generation errors are surfaced to the user and never silently replaced with tutorial or generic copy.

Daily entries are stored in Supabase Postgres and photos are stored in the private `daily-photos` bucket. Row Level Security limits both to the signed-in user. Older `localStorage` entries are migrated after the first successful Google login, then removed from the browser.

## Supabase and Google login

1. Create a Supabase project and run `supabase/migrations/202608290001_google_auth_and_cloud_entries.sql` in its SQL editor.
2. In Google Auth Platform, create a Web application OAuth client. Add the Supabase callback URL shown on the Supabase Google provider page as an authorized redirect URI.
3. Enable Google in Supabase Authentication providers and enter that client ID and secret.
4. Set the Supabase Site URL to the production domain. Add `http://localhost:3000/auth/callback` and the production `/auth/callback` URL to the redirect allow list.
5. Put the project URL and publishable key in `.env.local` and in the Vercel Production and Preview environments.

Only the publishable key uses `NEXT_PUBLIC_`. Never expose the Supabase service-role key or Google client secret to the browser.

## Prototype data model

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

## Deploy with Vercel

1. Push the repository to GitHub and import it from the Vercel dashboard.
2. Keep the Framework Preset on `Next.js` and add `OPENAI_API_KEY` as a server-side environment variable for Production and Preview.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` for Production and Preview.
4. Optionally add `OPENAI_VISION_MODEL`; otherwise the app uses `gpt-5.6-luna`.
5. Add one Vercel Firewall rate-limit rule for the path `/api/generate`: 5 requests per 10 minutes, counted by IP, with a `429` response.
6. Deploy, then verify Google login, cloud restore, and generation in a signed-out private window and on a phone.

Never prefix the API key with `NEXT_PUBLIC_`; that would expose it to browsers.

## Tech

- React 19 + TypeScript
- Next.js App Router
- Tailwind CSS 4
- CSS motion and responsive layout
- Supabase Auth, Postgres, and private Storage
- Browser `localStorage` for sound preference and one-time legacy migration
