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

The prototype is designed to make that idea understandable in the first few seconds of a contest demo. It ships with a complete sample day and does not need an AI key.

## Main features

- Upload multiple photos with drag-and-drop or a file picker
- Add an optional note to explain what happened in each photo
- Generate a short bilingual diary through a replaceable mock AI function
- Learn five conversational expressions tied back to individual photos
- Save daily entries to `localStorage`
- Review saved expressions with Japanese-to-English and fill-in-the-blank quizzes
- Browse saved days in a visual photo archive
- Responsive layouts for phones, tablets, and desktop screens

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production build:

```bash
npm run build
```

## Connecting a real AI API later

The AI boundary lives in `lib/daily-english.ts`:

```ts
generateDailyEnglish(photos: PhotoEntry[]): Promise<DailyEntry>
```

It currently returns a deterministic mock after a short delay. To connect a Vision-capable model:

1. Keep the existing `DailyEntry` return type.
2. Move the model call to a server-side route or server action so the API key never reaches the browser.
3. Send resized photos and their optional notes together as a sequence of moments.
4. Instruct the model to describe plausible experiences, prioritize user notes, avoid unsupported guesses, and return 3–6 reusable conversational expressions.
5. Validate the model response against the TypeScript shape before returning it to the UI.

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

## Tech

- React 19 + TypeScript
- vinext / Vite
- Tailwind CSS 4
- CSS motion and responsive layout
- Browser `localStorage`
