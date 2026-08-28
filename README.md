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
- Save daily entries to `localStorage`
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

The browser resizes photos so a five-photo request remains below Vercel's request limit, then sends them to the same-origin `/api/generate` endpoint only when the user presses Generate. The Next.js route calls the OpenAI Responses API with image inputs and a strict JSON schema; the API key remains server-side.

- `lib/daily-english.ts` owns the client boundary and local data model.
- `lib/vision-generator.ts` validates requests, sends each image and note to the model, validates the structured result, and builds review cloze prompts.
- `app/api/generate/route.ts` keeps the key in the hosted runtime, exposes the same-origin endpoint, and adds a production burst limit.
- Generation errors are surfaced to the user and never silently replaced with tutorial or generic copy.

The current local-storage layer is intentionally device-local for the prototype. A production version can replace it with account-based storage and an image object store without changing the core `DailyEntry` model.

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
3. Optionally add `OPENAI_VISION_MODEL`; otherwise the app uses `gpt-5.6-luna`.
4. Add one Vercel Firewall rate-limit rule for the path `/api/generate`: 5 requests per 10 minutes, counted by IP, with a `429` response.
5. Deploy, then verify the generated URL in a signed-out private window and on a phone.

Never prefix the API key with `NEXT_PUBLIC_`; that would expose it to browsers.

## Tech

- React 19 + TypeScript
- Next.js App Router
- Tailwind CSS 4
- CSS motion and responsive layout
- Browser `localStorage`
