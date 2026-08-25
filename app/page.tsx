"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createSampleDailyEntry,
  DailyEntry,
  Expression,
  generateDailyEnglish,
  PhotoEntry,
  SAMPLE_PHOTOS,
} from "../lib/daily-english";

type Screen = "home" | "create" | "today" | "review" | "history";
type Feedback = "correct" | "almost" | "wrong" | null;

const STORAGE_KEY = "daily-english-lens:entries";

function goTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/[.!?]/g, "").replace(/\s+/g, " ");
}

function distance(a: string, b: string) {
  const matrix = Array.from({ length: b.length + 1 }, (_, index) => [index]);
  for (let index = 0; index <= a.length; index += 1) matrix[0][index] = index;
  for (let row = 1; row <= b.length; row += 1) {
    for (let column = 1; column <= a.length; column += 1) {
      matrix[row][column] = b[row - 1] === a[column - 1]
        ? matrix[row - 1][column - 1]
        : Math.min(matrix[row - 1][column - 1], matrix[row][column - 1], matrix[row - 1][column]) + 1;
    }
  }
  return matrix[b.length][a.length];
}

function sampleYesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return createSampleDailyEntry(date);
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [photos, setPhotos] = useState<PhotoEntry[]>(SAMPLE_PHOTOS);
  const [activeEntry, setActiveEntry] = useState<DailyEntry>(() => createSampleDailyEntry());
  const [savedEntries, setSavedEntries] = useState<DailyEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedEntries(JSON.parse(stored));
      } else {
        const starter = [sampleYesterday()];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(starter));
        setSavedEntries(starter);
      }
    } catch {
      setSavedEntries([sampleYesterday()]);
    }
  }, []);

  const reviewItems = useMemo(
    () => savedEntries.flatMap((entry) => entry.expressions.map((expression) => ({ entry, expression }))),
    [savedEntries],
  );
  const currentReview = reviewItems[reviewIndex % Math.max(reviewItems.length, 1)];

  function navigate(next: Screen) {
    setScreen(next);
    setSavedNotice(false);
    goTop();
  }

  async function addFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const next = await Promise.all(images.map((file, index) => new Promise<PhotoEntry>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: `upload-${Date.now()}-${index}`,
        imageUrl: String(reader.result),
        note: "",
        label: file.name.replace(/\.[^.]+$/, ""),
        time: "Today",
      });
      reader.readAsDataURL(file);
    })));
    setPhotos((current) => [...current, ...next]);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void addFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void addFiles(event.dataTransfer.files);
  }

  async function createEnglish() {
    if (!photos.length) return;
    setGenerating(true);
    const result = await generateDailyEnglish(photos);
    setActiveEntry(result);
    setGenerating(false);
    navigate("today");
  }

  function saveToday() {
    const next = [activeEntry, ...savedEntries.filter((entry) => entry.id !== activeEntry.id)];
    setSavedEntries(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      const compact = next.map((entry) => ({
        ...entry,
        photos: entry.photos.map((photo, index) => ({
          ...photo,
          imageUrl: photo.imageUrl.startsWith("data:") ? SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length].imageUrl : photo.imageUrl,
        })),
      }));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
      setSavedEntries(compact);
    }
    setSavedNotice(true);
  }

  function checkAnswer() {
    if (!currentReview || !answer.trim()) return;
    const expected = normalizeAnswer(currentReview.expression.expression);
    const actual = normalizeAnswer(answer);
    if (actual === expected) setFeedback("correct");
    else if (distance(actual, expected) <= 2 || expected.includes(actual)) setFeedback("almost");
    else setFeedback("wrong");
  }

  function nextQuestion() {
    setReviewIndex((index) => (index + 1) % Math.max(reviewItems.length, 1));
    setAnswer("");
    setFeedback(null);
  }

  return (
    <main>
      <Header screen={screen} onNavigate={navigate} reviewCount={reviewItems.length} />

      {screen === "home" && (
        <HomeScreen
          entry={activeEntry}
          savedEntries={savedEntries}
          onCreate={() => navigate("create")}
          onToday={() => navigate("today")}
          onReview={() => navigate("review")}
          onHistory={() => navigate("history")}
        />
      )}

      {screen === "create" && (
        <CreateScreen
          photos={photos}
          dragging={dragging}
          generating={generating}
          fileInput={fileInput}
          onDragState={setDragging}
          onDrop={handleDrop}
          onFileInput={handleFileInput}
          onPick={() => fileInput.current?.click()}
          onReset={() => setPhotos(SAMPLE_PHOTOS.map((photo) => ({ ...photo })))}
          onRemove={(id) => setPhotos((items) => items.filter((item) => item.id !== id))}
          onNote={(id, note) => setPhotos((items) => items.map((item) => item.id === id ? { ...item, note } : item))}
          onGenerate={() => void createEnglish()}
        />
      )}

      {screen === "today" && (
        <TodayScreen entry={activeEntry} saved={savedNotice} onSave={saveToday} onReview={() => navigate("review")} />
      )}

      {screen === "review" && (
        <ReviewScreen
          item={currentReview}
          answer={answer}
          feedback={feedback}
          index={reviewIndex}
          total={reviewItems.length}
          onAnswer={(value) => { setAnswer(value); setFeedback(null); }}
          onCheck={checkAnswer}
          onNext={nextQuestion}
          onCreate={() => navigate("create")}
        />
      )}

      {screen === "history" && (
        <HistoryScreen entries={savedEntries} onOpen={(entry) => { setActiveEntry(entry); navigate("today"); }} />
      )}

      <MobileNav screen={screen} onNavigate={navigate} />
    </main>
  );
}

function Header({ screen, onNavigate, reviewCount }: { screen: Screen; onNavigate: (screen: Screen) => void; reviewCount: number }) {
  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Primary navigation">
        <button className="brand" type="button" onClick={() => onNavigate("home")} aria-label="Daily English Lens home">
          <span className="brand-mark">D</span>
          <span>Daily English Lens</span>
        </button>
        <div className="desktop-nav">
          <button className={screen === "today" ? "active" : ""} onClick={() => onNavigate("today")}>Today</button>
          <button className={screen === "history" ? "active" : ""} onClick={() => onNavigate("history")}>Past days</button>
          <button className={`nav-action ${screen === "review" ? "active" : ""}`} onClick={() => onNavigate("review")}>Review <span>{reviewCount || 5}</span></button>
        </div>
      </nav>
    </header>
  );
}

function HomeScreen({ entry, savedEntries, onCreate, onToday, onReview, onHistory }: {
  entry: DailyEntry;
  savedEntries: DailyEntry[];
  onCreate: () => void;
  onToday: () => void;
  onReview: () => void;
  onHistory: () => void;
}) {
  return (
    <>
      <section className="hero" id="top">
        <div className="hero-copy reveal">
          <p className="eyebrow"><span /> Your life is the lesson</p>
          <h1>Turn your day<br />into <em>English.</em></h1>
          <p className="hero-description">今日撮った写真から、<br />あなたが本当に使える英語が生まれる。</p>
          <button className="primary-button" type="button" onClick={onCreate}>
            Create today&apos;s English <span aria-hidden="true">↗</span>
          </button>
          <p className="microcopy">No textbook. Just your day.</p>
        </div>

        <div className="memory-stack reveal delay" aria-label="Today’s sample moments">
          {[entry.photos[0], entry.photos[1], entry.photos[4]].map((moment, index) => moment && (
            <figure className={`memory-card memory-${index + 1}`} key={moment.id}>
              <img src={moment.imageUrl} alt={moment.label || "A moment from today"} />
              <figcaption><span>{moment.time}</span><span className="heart">♡</span></figcaption>
            </figure>
          ))}
          <div className="phrase-note">
            <span className="note-label">TODAY’S PHRASE</span>
            <strong>I got caught<br />in the rain.</strong>
            <span className="translation">急な雨に降られた</span>
          </div>
        </div>
      </section>

      <section className="home-hub section-shell">
        <div className="section-heading">
          <div><p className="kicker">A little English, every day</p><h2>Your day is already<br />full of words.</h2></div>
          <p>特別な教材はいらない。<br />今日の記憶だから、英語が自分の言葉になる。</p>
        </div>
        <div className="hub-grid">
          <button className="hub-card today-card" onClick={onToday}>
            <div className="hub-card-top"><span className="hub-icon">✶</span><span>01</span></div>
            <div><p>Today&apos;s English</p><strong>The train was<br /><em>packed.</em></strong></div>
            <span className="card-link">Open today →</span>
          </button>
          <button className="hub-card review-card" onClick={onReview}>
            <div className="hub-card-top"><span className="hub-icon">↻</span><span>02</span></div>
            <div><p>Review yesterday</p><strong>「びしょ濡れになる」<br />覚えてる？</strong></div>
            <span className="quiz-pill">get ______</span>
          </button>
          <button className="hub-card history-card" onClick={onHistory}>
            <div className="hub-card-top"><span className="hub-icon">☷</span><span>03</span></div>
            <div><p>Past days</p><strong>{Math.max(savedEntries.length, 1)} days,<br />your own English.</strong></div>
            <div className="mini-photos">
              {entry.photos.slice(0, 4).map((photo) => <img src={photo.imageUrl} alt="" key={photo.id} />)}
            </div>
          </button>
        </div>
        <div className="life-loop" aria-label="Life to English learning loop">
          {[["Life", "写真と出来事"], ["English", "使える表現"], ["Memory", "自分の記憶"], ["Review", "翌日の復習"]].map(([title, caption], index) => (
            <div className="loop-step" key={title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{title}</strong><small>{caption}</small></div>
          ))}
        </div>
      </section>
      <Footer />
    </>
  );
}

function CreateScreen({ photos, dragging, generating, fileInput, onDragState, onDrop, onFileInput, onPick, onReset, onRemove, onNote, onGenerate }: {
  photos: PhotoEntry[];
  dragging: boolean;
  generating: boolean;
  fileInput: React.RefObject<HTMLInputElement | null>;
  onDragState: (dragging: boolean) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onPick: () => void;
  onReset: () => void;
  onRemove: (id: string) => void;
  onNote: (id: string, note: string) => void;
  onGenerate: () => void;
}) {
  return (
    <section className="app-screen section-shell reveal">
      <div className="screen-intro">
        <div><p className="step-label"><span>1</span> Choose your moments</p><h2>What did today<br /><em>feel like?</em></h2></div>
        <p>上手な写真じゃなくても大丈夫。<br />「今日らしい」と思う瞬間を選んでください。</p>
      </div>

      <div
        className={`drop-zone ${dragging ? "dragging" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); onDragState(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => onDragState(false)}
        onDrop={onDrop}
      >
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onFileInput} />
        <span className="drop-icon">+</span>
        <div><strong>Drop today&apos;s photos here</strong><p>or choose from your device</p></div>
        <button className="secondary-button" type="button" onClick={onPick}>Choose photos</button>
      </div>

      <div className="photo-list-header">
        <div><strong>{photos.length} moments</strong><span>Add a note so AI understands your story.</span></div>
        <button type="button" onClick={onReset}>Use sample day</button>
      </div>

      {photos.length ? (
        <div className="photo-editor-grid">
          {photos.map((photo, index) => (
            <article className="photo-editor" key={photo.id}>
              <div className="editor-photo-wrap">
                <img src={photo.imageUrl} alt={photo.label || `Moment ${index + 1}`} />
                <span className="photo-number">{String(index + 1).padStart(2, "0")}</span>
                <button className="remove-photo" onClick={() => onRemove(photo.id)} aria-label={`Remove ${photo.label || "photo"}`}>×</button>
              </div>
              <label htmlFor={`note-${photo.id}`}>
                <span>What happened? <small>optional</small></span>
                <textarea id={`note-${photo.id}`} value={photo.note || ""} onChange={(event) => onNote(photo.id, event.target.value)} placeholder="例：友達と食べた" rows={2} />
              </label>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><span>◌</span><h3>Your day is waiting.</h3><p>写真を1枚以上追加してください。</p></div>
      )}

      <div className="generate-bar">
        <div><span className="spark">✶</span><p><strong>AI looks beyond the objects.</strong><br />It turns the story behind each photo into natural English.</p></div>
        <button className="primary-button" type="button" disabled={!photos.length || generating} onClick={onGenerate}>
          {generating ? "Reading your day…" : "Turn my day into English"}
          <span className={generating ? "loading-dot" : ""}>{generating ? "•" : "↗"}</span>
        </button>
      </div>
    </section>
  );
}

function TodayScreen({ entry, saved, onSave, onReview }: { entry: DailyEntry; saved: boolean; onSave: () => void; onReview: () => void }) {
  return (
    <section className="app-screen section-shell result-screen reveal">
      <div className="result-heading">
        <p className="kicker">{formatDay(entry.date)} · Your daily lens</p>
        <h2>Your Day<br /><em>in English.</em></h2>
        <p>写真に写った「もの」ではなく、<br />今日のあなたが話したくなること。</p>
      </div>

      <div className="day-filmstrip">
        {entry.photos.map((photo, index) => (
          <figure key={photo.id}>
            <img src={photo.imageUrl} alt={photo.label || `Moment ${index + 1}`} />
            <figcaption><span>{photo.time || `Moment ${index + 1}`}</span><small>{photo.label}</small></figcaption>
          </figure>
        ))}
      </div>

      <article className="diary-card">
        <div className="diary-label"><span>✶</span><p>Your story</p><small>ENGLISH DIARY</small></div>
        <div className="diary-copy">
          <p className="diary-en">{entry.diaryEnglish}</p>
          <div className="diary-rule" />
          <p className="diary-ja">{entry.diaryJapanese}</p>
        </div>
      </article>

      <div className="expressions-heading">
        <div><p className="kicker">Keep these with you</p><h2>Today&apos;s English</h2></div>
        <p>{entry.expressions.length} expressions from your own day</p>
      </div>
      <div className="expression-grid">
        {entry.expressions.map((expression, index) => (
          <ExpressionCard key={expression.id} expression={expression} index={index} photo={entry.photos.find((photo) => photo.id === expression.photoId)} />
        ))}
      </div>

      <div className="save-panel">
        <div><span className="save-mark">D</span><p><strong>{saved ? "Saved to your memories." : "Keep today close."}</strong><br />{saved ? "Come back tomorrow for a quick review." : "Save these expressions and meet them again tomorrow."}</p></div>
        <button className={saved ? "secondary-button saved-button" : "primary-button"} onClick={saved ? onReview : onSave}>
          {saved ? "Start a quick review" : "Save today's English"}<span>{saved ? "→" : "♡"}</span>
        </button>
      </div>
    </section>
  );
}

function ExpressionCard({ expression, index, photo }: { expression: Expression; index: number; photo?: PhotoEntry }) {
  return (
    <article className="expression-card">
      <div className="expression-photo">{photo && <img src={photo.imageUrl} alt="" />}<span>{String(index + 1).padStart(2, "0")}</span></div>
      <div className="expression-body">
        <p className="expression-word">{expression.expression}</p>
        <p className="expression-ja">{expression.japanese}</p>
        <blockquote>{expression.example}</blockquote>
        <div className="nuance"><span>NUANCE</span><p>{expression.explanation}</p></div>
      </div>
    </article>
  );
}

function ReviewScreen({ item, answer, feedback, index, total, onAnswer, onCheck, onNext, onCreate }: {
  item?: { entry: DailyEntry; expression: Expression };
  answer: string;
  feedback: Feedback;
  index: number;
  total: number;
  onAnswer: (answer: string) => void;
  onCheck: () => void;
  onNext: () => void;
  onCreate: () => void;
}) {
  if (!item) return <section className="app-screen section-shell empty-review"><h2>No memories yet.</h2><p>今日の英語を保存すると、ここで復習できます。</p><button className="primary-button" onClick={onCreate}>Create today&apos;s English <span>↗</span></button></section>;

  const { entry, expression } = item;
  const photo = entry.photos.find((entryPhoto) => entryPhoto.id === expression.photoId) || entry.photos[0];
  const feedbackCopy = feedback === "correct" ? ["Correct!", "あの日の英語、ちゃんと残っています。"] : feedback === "almost" ? ["Almost!", "もう少し。綴りと語順を確認しよう。"] : ["Try again", "写真の瞬間を思い出してみよう。"];

  return (
    <section className="app-screen review-screen section-shell reveal">
      <div className="review-topline">
        <div><p className="kicker">A moment from {formatDay(entry.date)}</p><h2>Do you remember<br /><em>this day?</em></h2></div>
        <div className="review-progress"><span>{Math.min(index + 1, total)}</span> / {total}<div><i style={{ width: `${((index % Math.max(total, 1)) + 1) / Math.max(total, 1) * 100}%` }} /></div></div>
      </div>

      <div className="quiz-layout">
        <figure className="review-photo">
          <img src={photo?.imageUrl} alt={photo?.label || "A memory from this day"} />
          <figcaption><span>{photo?.time}</span><strong>{photo?.label}</strong></figcaption>
        </figure>
        <div className="quiz-card">
          <p className="quiz-type">JAPANESE <span>→</span> ENGLISH</p>
          <h3>{expression.japanese}</h3>
          <p className="quiz-context">{expression.cloze}</p>
          <label htmlFor="quiz-answer">Your answer</label>
          <div className={`answer-wrap ${feedback || ""}`}>
            <input id="quiz-answer" value={answer} onChange={(event) => onAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") feedback ? onNext() : onCheck(); }} placeholder="Type it in English…" autoComplete="off" />
            <span>{feedback === "correct" ? "✓" : feedback ? "!" : ""}</span>
          </div>
          {feedback && <div className={`feedback ${feedback}`}><strong>{feedbackCopy[0]}</strong><p>{feedbackCopy[1]}</p>{feedback !== "correct" && <small>Answer: <b>{expression.expression}</b></small>}</div>}
          <button className="primary-button quiz-button" onClick={feedback ? onNext : onCheck} disabled={!answer.trim()}>
            {feedback ? "Next memory" : "Check my answer"}<span>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function HistoryScreen({ entries, onOpen }: { entries: DailyEntry[]; onOpen: (entry: DailyEntry) => void }) {
  return (
    <section className="app-screen section-shell reveal">
      <div className="screen-intro history-intro">
        <div><p className="kicker">Your English archive</p><h2>Past days,<br /><em>kept close.</em></h2></div>
        <p>写真といっしょに残るから、<br />表現の奥にある出来事まで思い出せる。</p>
      </div>
      <div className="history-grid">
        {entries.map((entry) => (
          <button className="history-entry" key={entry.id} onClick={() => onOpen(entry)}>
            <div className="history-collage">
              {entry.photos.slice(0, 3).map((photo) => <img src={photo.imageUrl} alt="" key={photo.id} />)}
            </div>
            <div className="history-info"><div><span>{formatDay(entry.date)}</span><strong>{entry.expressions[0]?.example}</strong></div><span className="history-count">{entry.expressions.length} phrases ↗</span></div>
          </button>
        ))}
      </div>
    </section>
  );
}

function MobileNav({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  return <nav className="mobile-nav" aria-label="Mobile navigation">
    {([["home", "○", "Home"], ["today", "✶", "Today"], ["create", "+", "Create"], ["review", "↻", "Review"], ["history", "☷", "Past"]] as const).map(([target, icon, label]) => (
      <button
        type="button"
        className={screen === target ? "active" : ""}
        aria-current={screen === target ? "page" : undefined}
        aria-label={label}
        key={target}
        onClick={() => onNavigate(target)}
      >
        <span aria-hidden="true">{icon}</span><small>{label}</small>
      </button>
    ))}
  </nav>;
}

function Footer() {
  return <footer><div className="section-shell"><div className="brand"><span className="brand-mark">D</span><span>Daily English Lens</span></div><p>Traditional apps teach someone else&apos;s words.<br />This one starts with <em>your life.</em></p><span>© 2026 · Prototype</span></div></footer>;
}
