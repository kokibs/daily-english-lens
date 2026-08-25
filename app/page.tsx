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

type Screen = "home" | "today" | "review" | "history";
type Feedback = "correct" | "almost" | "wrong" | null;

const STORAGE_KEY = "daily-english-lens:entries";

function formatDay(date: string, long = true) {
  return new Intl.DateTimeFormat("en-US", long
    ? { weekday: "long", month: "long", day: "numeric" }
    : { month: "short", day: "numeric" }
  ).format(new Date(`${date}T12:00:00`));
}

function todayLabel() {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date());
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
  const [photos, setPhotos] = useState<PhotoEntry[]>(SAMPLE_PHOTOS.map((photo) => ({ ...photo })));
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(SAMPLE_PHOTOS[0].id);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<DailyEntry>(() => createSampleDailyEntry());
  const [savedEntries, setSavedEntries] = useState<DailyEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [fileDragging, setFileDragging] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(4);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSavedEntries(JSON.parse(stored));
      else {
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToCreate() {
    setScreen("home");
    setSavedNotice(false);
    window.setTimeout(() => document.getElementById("today-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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
        time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(file.lastModified)),
      });
      reader.readAsDataURL(file);
    })));
    if (next.length) setSelectedPhotoId(next[0].id);
    setPhotos((current) => [...current, ...next]);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void addFiles(event.target.files);
    event.target.value = "";
  }

  function handleFileDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setFileDragging(false);
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  }

  function removePhoto(id: string) {
    setPhotos((items) => {
      const next = items.filter((item) => item.id !== id);
      if (selectedPhotoId === id) setSelectedPhotoId(next[0]?.id ?? null);
      return next;
    });
  }

  function movePhoto(id: string, direction: -1 | 1) {
    setPhotos((items) => {
      const index = items.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function reorderPhoto(targetId: string) {
    if (!draggedPhotoId || draggedPhotoId === targetId) return;
    setPhotos((items) => {
      const from = items.findIndex((item) => item.id === draggedPhotoId);
      const to = items.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return items;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedPhotoId(null);
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
    const suffix = expected.split(" ").slice(1).join(" ");
    const actual = normalizeAnswer(answer);
    if (actual === expected || (suffix && actual === suffix)) setFeedback("correct");
    else if (distance(actual, expected) <= 2 || (suffix && distance(actual, suffix) <= 2) || expected.includes(actual)) setFeedback("almost");
    else setFeedback("wrong");
  }

  function nextQuestion() {
    setReviewIndex((index) => (index + 1) % Math.max(reviewItems.length, 1));
    setAnswer("");
    setFeedback(null);
  }

  return (
    <main>
      <Header screen={screen} reviewCount={reviewItems.length} onNavigate={navigate} onCreate={goToCreate} />

      {screen === "home" && (
        <Dashboard
          photos={photos}
          selectedPhotoId={selectedPhotoId}
          draggedPhotoId={draggedPhotoId}
          fileDragging={fileDragging}
          generating={generating}
          savedEntries={savedEntries}
          reviewItem={currentReview}
          answer={answer}
          feedback={feedback}
          fileInput={fileInput}
          onPick={() => fileInput.current?.click()}
          onFileInput={handleFileInput}
          onFileDrag={setFileDragging}
          onFileDrop={handleFileDrop}
          onSelect={setSelectedPhotoId}
          onRemove={removePhoto}
          onMove={movePhoto}
          onDragStart={setDraggedPhotoId}
          onDropPhoto={reorderPhoto}
          onNote={(id, note) => setPhotos((items) => items.map((item) => item.id === id ? { ...item, note } : item))}
          onClear={() => { setPhotos([]); setSelectedPhotoId(null); }}
          onSample={() => { setPhotos(SAMPLE_PHOTOS.map((photo) => ({ ...photo }))); setSelectedPhotoId(SAMPLE_PHOTOS[0].id); }}
          onGenerate={() => void createEnglish()}
          onAnswer={(value) => { setAnswer(value); setFeedback(null); }}
          onCheck={checkAnswer}
          onNext={nextQuestion}
          onOpenReview={() => navigate("review")}
          onOpenHistory={() => navigate("history")}
          onOpenEntry={(entry) => { setActiveEntry(entry); navigate("today"); }}
        />
      )}

      {screen === "today" && (
        <TodayScreen entry={activeEntry} saved={savedNotice} onSave={saveToday} onReview={() => navigate("review")} onCreate={goToCreate} />
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
          onCreate={goToCreate}
        />
      )}

      {screen === "history" && (
        <HistoryScreen entries={savedEntries} onOpen={(entry) => { setActiveEntry(entry); navigate("today"); }} onCreate={goToCreate} />
      )}

      <MobileNav screen={screen} onNavigate={navigate} onCreate={goToCreate} />
    </main>
  );
}

function Header({ screen, reviewCount, onNavigate, onCreate }: {
  screen: Screen;
  reviewCount: number;
  onNavigate: (screen: Screen) => void;
  onCreate: () => void;
}) {
  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Primary navigation">
        <button className="brand" type="button" onClick={() => onNavigate("home")} aria-label="Daily English Lens home">
          <span className="brand-mark">D</span><span>Daily English Lens</span>
        </button>
        <div className="desktop-nav">
          <button className={screen === "home" ? "active" : ""} onClick={() => onNavigate("home")}>Home</button>
          <button className={screen === "today" ? "active" : ""} onClick={() => onNavigate("today")}>Today</button>
          <button className={screen === "review" ? "active" : ""} onClick={() => onNavigate("review")}>Review <span className="count-badge">{reviewCount || 5}</span></button>
          <button className={screen === "history" ? "active" : ""} onClick={() => onNavigate("history")}>Past days</button>
        </div>
        <button className="header-create" type="button" onClick={onCreate}><span>+</span> Add photos</button>
      </nav>
    </header>
  );
}

function Dashboard(props: {
  photos: PhotoEntry[];
  selectedPhotoId: string | null;
  draggedPhotoId: string | null;
  fileDragging: boolean;
  generating: boolean;
  savedEntries: DailyEntry[];
  reviewItem?: { entry: DailyEntry; expression: Expression };
  answer: string;
  feedback: Feedback;
  fileInput: React.RefObject<HTMLInputElement | null>;
  onPick: () => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onFileDrag: (dragging: boolean) => void;
  onFileDrop: (event: DragEvent<HTMLElement>) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDragStart: (id: string) => void;
  onDropPhoto: (id: string) => void;
  onNote: (id: string, note: string) => void;
  onClear: () => void;
  onSample: () => void;
  onGenerate: () => void;
  onAnswer: (answer: string) => void;
  onCheck: () => void;
  onNext: () => void;
  onOpenReview: () => void;
  onOpenHistory: () => void;
  onOpenEntry: (entry: DailyEntry) => void;
}) {
  const selected = props.photos.find((photo) => photo.id === props.selectedPhotoId) ?? props.photos[0];

  return (
    <>
      <section className="dashboard section-shell reveal">
        <div className="dashboard-welcome">
          <div>
            <p className="kicker">Good evening · {todayLabel()}</p>
            <h1>Turn your day into English.</h1>
            <p>今日の写真を選んで、3分で自分だけの英語教材に。</p>
          </div>
          <ProgressRail photoCount={props.photos.length} />
        </div>

        <section
          className={`today-workspace ${props.fileDragging ? "file-dragging" : ""}`}
          id="today-workspace"
          onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); props.onFileDrag(true); } }}
          onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) props.onFileDrag(false); }}
          onDrop={props.onFileDrop}
        >
          <input ref={props.fileInput} type="file" accept="image/*" multiple hidden onChange={props.onFileInput} />
          <div className="workspace-head">
            <div className="section-title-row">
              <span className="step-number primary">1</span>
              <div><p className="section-eyebrow">PRIMARY · TODAY</p><h2>Add today&apos;s photos</h2><small>今日を思い出せる写真を、3〜6枚選びましょう。</small></div>
            </div>
            <div className="workspace-actions">
              <button type="button" onClick={props.onSample}>Sample day</button>
              {props.photos.length > 0 && <button type="button" className="danger-link" onClick={props.onClear}>Clear</button>}
            </div>
          </div>

          {props.photos.length ? (
            <>
              <div className="photo-input-grid" aria-label="Selected photos">
                {props.photos.map((photo, index) => (
                  <article
                    className={`photo-input ${photo.id === selected?.id ? "selected" : ""} ${photo.id === props.draggedPhotoId ? "dragging" : ""}`}
                    key={photo.id}
                    draggable
                    onDragStart={() => props.onDragStart(photo.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.preventDefault(); event.stopPropagation(); props.onDropPhoto(photo.id); }}
                  >
                    <button className="photo-select" type="button" onClick={() => props.onSelect(photo.id)} aria-label={`Edit ${photo.label || `photo ${index + 1}`}`}>
                      <img src={photo.imageUrl} alt={photo.label || `Moment ${index + 1}`} />
                      <span className="drag-handle" aria-hidden="true">⋮⋮</span>
                      <span className="photo-order">{String(index + 1).padStart(2, "0")}</span>
                      {photo.note && <span className="note-status">✓ Note</span>}
                    </button>
                    <div className="photo-input-meta"><span>{photo.time || "Today"}</span><button type="button" onClick={() => props.onRemove(photo.id)} aria-label={`Remove ${photo.label || "photo"}`}>×</button></div>
                  </article>
                ))}
                <button className="add-photo-tile" type="button" onClick={props.onPick}><span>+</span><strong>Add photos</strong><small>JPG, PNG, HEIC</small></button>
              </div>

              {selected && (
                <div className="photo-detail-editor">
                  <img src={selected.imageUrl} alt={selected.label || "Selected moment"} />
                  <div className="detail-form">
                    <div className="detail-toolbar">
                      <div><span>Selected moment</span><strong>{selected.time || "Today"} · {selected.label || "Photo"}</strong></div>
                      <div><button type="button" onClick={() => props.onMove(selected.id, -1)} aria-label="Move photo left">←</button><button type="button" onClick={() => props.onMove(selected.id, 1)} aria-label="Move photo right">→</button></div>
                    </div>
                    <label htmlFor={`note-${selected.id}`}>What happened? <span>optional</span></label>
                    <textarea id={`note-${selected.id}`} value={selected.note || ""} onChange={(event) => props.onNote(selected.id, event.target.value)} placeholder="例：友達と急いで昼ごはんを食べた" rows={3} />
                    <p>AIは写真の物体名ではなく、この補足から「何があったか」を優先します。</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button className="empty-uploader" type="button" onClick={props.onPick}>
              <span>+</span><strong>Choose today&apos;s photos</strong><small>Tap to select, or drop photos here</small>
            </button>
          )}

          <div className="workspace-footer">
            <div className="readiness"><span className={props.photos.length ? "ready" : ""} /> <p><strong>{props.photos.length ? `${props.photos.length} moments ready` : "Add at least one photo"}</strong><small>Notes are optional. You can edit them above.</small></p></div>
            <button className="generate-button" type="button" disabled={!props.photos.length || props.generating} onClick={props.onGenerate}>
              <span className="button-step">2</span><span>{props.generating ? "Reading your day…" : "Generate today's English"}</span><b>{props.generating ? "•" : "→"}</b>
            </button>
          </div>
        </section>

        <QuickReview
          item={props.reviewItem}
          answer={props.answer}
          feedback={props.feedback}
          onAnswer={props.onAnswer}
          onCheck={props.onCheck}
          onNext={props.onNext}
          onOpenReview={props.onOpenReview}
        />

        <RecentDays entries={props.savedEntries} onOpen={props.onOpenEntry} onOpenHistory={props.onOpenHistory} />
      </section>
      <ConceptSection />
    </>
  );
}

function ProgressRail({ photoCount }: { photoCount: number }) {
  return (
    <div className="progress-rail" aria-label="Today's progress">
      <div className="active"><span>1</span><p><strong>Add photos</strong><small>{photoCount ? `${photoCount} selected` : "Start here"}</small></p></div>
      <i />
      <div><span>2</span><p><strong>Generate</strong><small>About 10 sec</small></p></div>
      <i />
      <div><span>3</span><p><strong>Review</strong><small>Tomorrow</small></p></div>
    </div>
  );
}

function QuickReview({ item, answer, feedback, onAnswer, onCheck, onNext, onOpenReview }: {
  item?: { entry: DailyEntry; expression: Expression };
  answer: string;
  feedback: Feedback;
  onAnswer: (answer: string) => void;
  onCheck: () => void;
  onNext: () => void;
  onOpenReview: () => void;
}) {
  if (!item) return null;
  const photo = item.entry.photos.find((candidate) => candidate.id === item.expression.photoId) ?? item.entry.photos[0];
  const words = item.expression.expression.split(" ");
  const prefix = words.length > 1 ? words[0] : "";
  const prompt = prefix ? `Type the word after “${prefix}”` : "Type the expression";

  return (
    <section className="quick-review-section">
      <div className="section-title-row compact">
        <span className="step-number secondary">3</span>
        <div><p className="section-eyebrow">SECONDARY · YESTERDAY</p><h2>Quick review</h2><small>昨日の写真と、1問だけ。</small></div>
      </div>
      <div className="quick-review-card">
        <div className="quick-memory">
          <img src={photo?.imageUrl} alt={photo?.label || "Yesterday's memory"} />
          <div><span>{formatDay(item.entry.date, false)} · {photo?.time}</span><strong>{photo?.label}</strong></div>
        </div>
        <div className="inline-quiz">
          <div className="quiz-prompt"><span>Yesterday&apos;s expression</span><h3>{item.expression.japanese}</h3><p>{item.expression.cloze}</p></div>
          <label htmlFor="home-review-answer">{prompt}</label>
          <div className={`inline-answer ${feedback || ""}`}>
            {prefix && <span>{prefix}</span>}
            <input id="home-review-answer" value={answer} onChange={(event) => onAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") feedback ? onNext() : onCheck(); }} placeholder="________" autoComplete="off" />
            <button type="button" onClick={feedback ? onNext : onCheck} disabled={!answer.trim()}>{feedback ? "Next" : "Check answer"}</button>
          </div>
          {feedback && (
            <div className={`inline-feedback ${feedback}`}>
              <span>{feedback === "correct" ? "✓" : "!"}</span>
              <p><strong>{feedback === "correct" ? "Correct!" : feedback === "almost" ? "Almost!" : "Try again"} <b>{item.expression.expression}</b></strong><small>{item.expression.example}</small></p>
            </div>
          )}
          <button className="text-link" type="button" onClick={onOpenReview}>Open full review →</button>
        </div>
      </div>
    </section>
  );
}

function RecentDays({ entries, onOpen, onOpenHistory }: { entries: DailyEntry[]; onOpen: (entry: DailyEntry) => void; onOpenHistory: () => void }) {
  const visible = entries.slice(0, 3);
  return (
    <section className="recent-section">
      <div className="recent-head"><div><p className="section-eyebrow">TERTIARY</p><h2>Past days</h2></div><button type="button" onClick={onOpenHistory}>View all →</button></div>
      <div className="recent-list">
        {visible.length ? visible.map((entry) => (
          <button className="recent-row" type="button" key={entry.id} onClick={() => onOpen(entry)}>
            <div className="recent-thumbs">{entry.photos.slice(0, 3).map((photo) => <img src={photo.imageUrl} alt="" key={photo.id} />)}</div>
            <div className="recent-copy"><span>{formatDay(entry.date)}</span><strong>{entry.expressions[0]?.example}</strong><small>{entry.expressions.length} expressions saved</small></div>
            <b>↗</b>
          </button>
        )) : <div className="no-history"><p>Your first day will appear here after you save it.</p></div>}
      </div>
    </section>
  );
}

function TodayScreen({ entry, saved, onSave, onReview, onCreate }: { entry: DailyEntry; saved: boolean; onSave: () => void; onReview: () => void; onCreate: () => void }) {
  return (
    <section className="app-screen result-screen section-shell reveal">
      <div className="page-toolbar"><div><p className="kicker">{formatDay(entry.date)} · Generated</p><h1>Your day in English</h1><p>写真を見ると、その日の英語が思い出せる。</p></div><button className="secondary-action" type="button" onClick={onCreate}>+ Add another day</button></div>

      <article className="diary-summary">
        <div><span>DAY SUMMARY</span><strong>✶</strong></div>
        <div><p>{entry.diaryEnglish}</p><small>{entry.diaryJapanese}</small></div>
      </article>

      <section className="moment-section">
        <div className="content-heading"><div><p className="section-eyebrow">MEMORY → ENGLISH</p><h2>Each moment,<br />in your words.</h2></div><p>{entry.photos.length} photos · {entry.expressions.length} expressions</p></div>
        <div className="moment-story-list">
          {entry.photos.map((photo, index) => {
            const moment = entry.moments?.find((candidate) => candidate.photoId === photo.id);
            const expression = entry.expressions.find((candidate) => candidate.photoId === photo.id);
            return (
              <article className="moment-story" key={photo.id}>
                <div className="moment-photo"><img src={photo.imageUrl} alt={photo.label || `Moment ${index + 1}`} /><span>{String(index + 1).padStart(2, "0")}</span></div>
                <div className="moment-copy">
                  <div className="moment-meta"><span>{photo.time || "Today"}</span><small>{photo.label}</small></div>
                  <strong>{moment?.english || expression?.example || "I wanted to remember this moment."}</strong>
                  <p>{moment?.japanese || expression?.japanese}</p>
                  {photo.note && <div className="source-note"><span>YOUR NOTE</span>{photo.note}</div>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="expression-section">
        <div className="content-heading"><div><p className="section-eyebrow">SAVE FOR LATER</p><h2>Today&apos;s English</h2></div><p>明日も使える、今日の表現。</p></div>
        <div className="expression-list">
          {entry.expressions.map((expression, index) => <ExpressionRow key={expression.id} expression={expression} index={index} />)}
        </div>
      </section>

      <div className="save-dock">
        <div><span className="save-icon">{saved ? "✓" : "♡"}</span><p><strong>{saved ? "Saved. See you tomorrow." : "Keep today in your memory."}</strong><small>{saved ? "Your review is ready." : "Save these expressions for tomorrow's review."}</small></p></div>
        <button type="button" onClick={saved ? onReview : onSave}>{saved ? "Start review" : "Save today's English"}<span>→</span></button>
      </div>
    </section>
  );
}

function ExpressionRow({ expression, index }: { expression: Expression; index: number }) {
  return (
    <article className="expression-row">
      <span>{String(index + 1).padStart(2, "0")}</span>
      <div><strong>{expression.expression}</strong><small>{expression.japanese}</small></div>
      <blockquote>{expression.example}</blockquote>
      <p>{expression.explanation}</p>
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
  if (!item) return <EmptyState title="No review yet" body="今日の英語を保存すると、明日ここで復習できます。" onCreate={onCreate} />;
  const photo = item.entry.photos.find((candidate) => candidate.id === item.expression.photoId) ?? item.entry.photos[0];
  return (
    <section className="app-screen review-page section-shell reveal">
      <div className="page-toolbar"><div><p className="kicker">Daily recall · {Math.min(index + 1, total)} of {total}</p><h1>Review yesterday</h1><p>写真の記憶から、英語を思い出そう。</p></div><div className="review-meter"><span style={{ width: `${((index % Math.max(total, 1)) + 1) / Math.max(total, 1) * 100}%` }} /></div></div>
      <div className="review-workspace">
        <figure><img src={photo?.imageUrl} alt={photo?.label || "Memory for this question"} /><figcaption><span>{formatDay(item.entry.date, false)} · {photo?.time}</span><strong>{photo?.label}</strong></figcaption></figure>
        <div className="review-question">
          <span className="question-type">JAPANESE → ENGLISH</span>
          <h2>{item.expression.japanese}</h2>
          <p>{item.expression.cloze}</p>
          <label htmlFor="review-answer">Your answer</label>
          <input id="review-answer" className={feedback || ""} value={answer} onChange={(event) => onAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") feedback ? onNext() : onCheck(); }} placeholder="Type it in English…" autoComplete="off" />
          {feedback && <div className={`review-feedback ${feedback}`}><strong>{feedback === "correct" ? "Correct!" : feedback === "almost" ? "Almost!" : "Try again"}</strong><p><b>{item.expression.expression}</b><br />{item.expression.example}</p></div>}
          <button className="review-submit" type="button" disabled={!answer.trim()} onClick={feedback ? onNext : onCheck}>{feedback ? "Next question" : "Check answer"}<span>→</span></button>
        </div>
      </div>
    </section>
  );
}

function HistoryScreen({ entries, onOpen, onCreate }: { entries: DailyEntry[]; onOpen: (entry: DailyEntry) => void; onCreate: () => void }) {
  if (!entries.length) return <EmptyState title="No days saved yet" body="今日の写真から、最初の英語を作ってみましょう。" onCreate={onCreate} />;
  return (
    <section className="app-screen history-page section-shell reveal">
      <div className="page-toolbar"><div><p className="kicker">Your English archive</p><h1>Past days</h1><p>写真と英語が、あなたの記憶として残ります。</p></div><button className="secondary-action" type="button" onClick={onCreate}>+ Create today</button></div>
      <div className="history-list">
        {entries.map((entry) => (
          <button className="history-row" type="button" key={entry.id} onClick={() => onOpen(entry)}>
            <div className="history-date"><strong>{new Date(`${entry.date}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(`${entry.date}T12:00:00`))}</span></div>
            <div className="history-thumbs">{entry.photos.slice(0, 4).map((photo) => <img src={photo.imageUrl} alt="" key={photo.id} />)}</div>
            <div className="history-copy"><span>{formatDay(entry.date)}</span><strong>{entry.diaryEnglish}</strong><small>{entry.expressions.length} expressions</small></div>
            <b>↗</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ title, body, onCreate }: { title: string; body: string; onCreate: () => void }) {
  return <section className="app-screen empty-page section-shell"><span>✶</span><h1>{title}</h1><p>{body}</p><button type="button" onClick={onCreate}>Add today&apos;s photos <b>→</b></button></section>;
}

function ConceptSection() {
  return (
    <section className="concept-section">
      <div className="section-shell">
        <div className="concept-copy"><p className="section-eyebrow">WHY IT WORKS</p><h2>Your life is<br />the lesson.</h2><p>Traditional apps teach someone else&apos;s words.<br />This one starts with <em>your life.</em></p></div>
        <div className="life-loop" aria-label="Life to English learning loop">
          {[["Life", "写真と出来事"], ["English", "使える表現"], ["Memory", "自分の記憶"], ["Review", "翌日の復習"]].map(([title, caption], index) => (
            <div key={title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{title}</strong><small>{caption}</small>{index < 3 && <b>→</b>}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MobileNav({ screen, onNavigate, onCreate }: { screen: Screen; onNavigate: (screen: Screen) => void; onCreate: () => void }) {
  const items: Array<[Screen, string, string]> = [["home", "○", "Create"], ["today", "✶", "Today"], ["review", "↻", "Review"], ["history", "☷", "Past"]];
  return <nav className="mobile-nav" aria-label="Mobile navigation">{items.map(([target, icon, label]) => <button type="button" key={target} className={screen === target ? "active" : ""} aria-current={screen === target ? "page" : undefined} onClick={target === "home" ? onCreate : () => onNavigate(target)}><span aria-hidden="true">{icon}</span><small>{label}</small></button>)}</nav>;
}
