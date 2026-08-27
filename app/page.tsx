"use client";

/* eslint-disable @next/next/no-img-element -- User-selected data URLs stay local and cannot use the Next image optimizer. */

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import {
  createDailyEntryFromPhotos,
  DailyEntry,
  dateOnly,
  Expression,
  generateDailyEnglish,
  hasLegacyTutorialOutput,
  isLegacyTutorialEntry,
  PhotoEntry,
} from "../lib/daily-english";

type Screen = "home" | "today" | "review" | "history";
type Feedback = "correct" | "almost" | "wrong" | null;

const STORAGE_KEY = "daily-english-lens:entries";
const SOUND_KEY = "daily-english-lens:quiz-sound";
const GENERATION_USAGE_KEY = "daily-english-lens:generation-usage";
const MAX_PHOTOS = 5;
const MAX_DAILY_GENERATIONS = 5;
const MAX_IMAGE_DATA_URL_LENGTH = 620_000;

function playSuccessChime() {
  const AudioContextClass = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  void context.resume();
  const start = context.currentTime;
  [659.25, 783.99, 987.77].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = start + index * 0.085;
    oscillator.type = index === 2 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.25);
  });
  window.setTimeout(() => void context.close(), 700);
}

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

function generationUsage() {
  const today = dateOnly(new Date());
  try {
    const stored = JSON.parse(window.localStorage.getItem(GENERATION_USAGE_KEY) ?? "null") as {
      date?: string;
      count?: number;
    } | null;
    return stored?.date === today && Number.isInteger(stored.count)
      ? { date: today, count: Math.max(0, stored.count ?? 0) }
      : { date: today, count: 0 };
  } catch {
    return { date: today, count: 0 };
  }
}

function recordGeneration() {
  const usage = generationUsage();
  try {
    window.localStorage.setItem(GENERATION_USAGE_KEY, JSON.stringify({
      date: usage.date,
      count: usage.count + 1,
    }));
  } catch {
    // The hosted API still applies its own burst limit when storage is unavailable.
  }
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

async function optimizedImageUrl(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");

    let maxSide = 1200;
    let quality = 0.82;
    let imageUrl = "";
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = "#f7f7f1";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      imageUrl = canvas.toDataURL("image/jpeg", quality);
      if (imageUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) break;
      maxSide = Math.round(maxSide * 0.84);
      quality = Math.max(0.58, quality - 0.06);
    }
    bitmap.close();
    if (imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw new Error("画像を公開用のサイズに縮小できませんでした。");
    }
    return imageUrl;
  } catch {
    const imageUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageUrl)
      || imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw new Error("この画像を読み込めませんでした。JPGまたはPNGで試してください。");
    }
    return imageUrl;
  }
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<DailyEntry | null>(null);
  const [savedEntries, setSavedEntries] = useState<DailyEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [fileDragging, setFileDragging] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [quizSoundEnabled, setQuizSoundEnabled] = useState(true);

  useEffect(() => {
    let migrated: DailyEntry[] = [];
    let soundEnabled = true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DailyEntry[];
        migrated = (Array.isArray(parsed) ? parsed : [])
          .filter((entry) => !isLegacyTutorialEntry(entry))
          .map((entry) => hasLegacyTutorialOutput(entry) && entry.photos?.length
            ? createDailyEntryFromPhotos(entry.photos, entry.date)
            : entry);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }
      soundEnabled = window.localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      migrated = [];
    }
    const timer = window.setTimeout(() => {
      setSavedEntries(migrated);
      setQuizSoundEnabled(soundEnabled);
    }, 0);
    return () => window.clearTimeout(timer);
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
    const remaining = Math.max(0, MAX_PHOTOS - photos.length);
    if (!remaining) {
      setGenerationError("写真は1日最大5枚までです。");
      return;
    }
    try {
      const next = await Promise.all(images.slice(0, remaining).map(async (file, index): Promise<PhotoEntry> => {
        const imageUrl = await optimizedImageUrl(file);
        return {
          id: `upload-${Date.now()}-${index}`,
          imageUrl,
          note: "",
          label: file.name.replace(/\.[^.]+$/, ""),
          time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(file.lastModified)),
        };
      }));
      if (next.length) setSelectedPhotoId(next[0].id);
      setPhotos((current) => [...current, ...next]);
      setGenerationError(images.length > remaining ? "写真は1日最大5枚までです。" : null);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "写真を読み込めませんでした。");
    }
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
    if (generationUsage().count >= MAX_DAILY_GENERATIONS) {
      setGenerationError("今日の生成は5回までです。明日になるとまた使えます。");
      return;
    }
    setGenerating(true);
    setGenerationError(null);
    try {
      const result = await generateDailyEnglish(photos);
      recordGeneration();
      setActiveEntry(result);
      navigate("today");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "写真を解析できませんでした。");
    } finally {
      setGenerating(false);
    }
  }

  function saveToday() {
    if (!activeEntry) return;
    const next = [activeEntry, ...savedEntries.filter((entry) => entry.id !== activeEntry.id)];
    setSavedEntries(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Keep the generated day in this session. Uploaded photos must never be
      // replaced by tutorial assets when browser storage is full.
    }
    setSavedNotice(true);
  }

  function checkAnswer() {
    if (!currentReview || !answer.trim()) return;
    const expected = normalizeAnswer(currentReview.expression.expression);
    const suffix = expected.split(" ").slice(1).join(" ");
    const actual = normalizeAnswer(answer);
    if (actual === expected || (suffix && actual === suffix)) {
      setFeedback("correct");
      if (quizSoundEnabled) playSuccessChime();
    } else if (distance(actual, expected) <= 2 || (suffix && distance(actual, suffix) <= 2) || expected.includes(actual)) {
      setFeedback("almost");
    } else {
      setFeedback("wrong");
    }
  }

  function toggleQuizSound() {
    setQuizSoundEnabled((enabled) => {
      const next = !enabled;
      try {
        window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        // Sound preference remains active for this session.
      }
      return next;
    });
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
          generationError={generationError}
          savedEntries={savedEntries}
          reviewItem={currentReview}
          answer={answer}
          feedback={feedback}
          soundEnabled={quizSoundEnabled}
          onPick={() => document.getElementById("photo-upload-input")?.click()}
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
          onGenerate={() => void createEnglish()}
          onAnswer={(value) => { setAnswer(value); setFeedback(null); }}
          onCheck={checkAnswer}
          onNext={nextQuestion}
          onToggleSound={toggleQuizSound}
          onOpenReview={() => navigate("review")}
          onOpenHistory={() => navigate("history")}
          onOpenEntry={(entry) => { setActiveEntry(entry); navigate("today"); }}
        />
      )}

      {screen === "today" && (
        activeEntry
          ? <TodayScreen key={activeEntry.id} entry={activeEntry} saved={savedNotice} onSave={saveToday} onReview={() => navigate("review")} onCreate={goToCreate} />
          : <EmptyState title="No English yet" body="今日の写真を追加すると、ここに英語が表示されます。" onCreate={goToCreate} />
      )}

      {screen === "review" && (
        <ReviewScreen
          item={currentReview}
          answer={answer}
          feedback={feedback}
          index={reviewIndex}
          total={reviewItems.length}
          soundEnabled={quizSoundEnabled}
          onAnswer={(value) => { setAnswer(value); setFeedback(null); }}
          onCheck={checkAnswer}
          onNext={nextQuestion}
          onToggleSound={toggleQuizSound}
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
          <button className={screen === "review" ? "active" : ""} onClick={() => onNavigate("review")}>Review {reviewCount > 0 && <span className="count-badge">{reviewCount}</span>}</button>
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
  generationError: string | null;
  savedEntries: DailyEntry[];
  reviewItem?: { entry: DailyEntry; expression: Expression };
  answer: string;
  feedback: Feedback;
  soundEnabled: boolean;
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
  onGenerate: () => void;
  onAnswer: (answer: string) => void;
  onCheck: () => void;
  onNext: () => void;
  onToggleSound: () => void;
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
          <input id="photo-upload-input" type="file" accept="image/*" multiple hidden onChange={props.onFileInput} />
          <div className="workspace-head">
            <div className="section-title-row">
              <span className="step-number primary">1</span>
              <div><p className="section-eyebrow">PRIMARY · TODAY</p><h2>Add today&apos;s photos</h2><small>今日を思い出せる写真を、1〜5枚選びましょう。</small></div>
            </div>
            <div className="workspace-actions">
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
                {props.photos.length < MAX_PHOTOS && <button className="add-photo-tile" type="button" onClick={props.onPick}><span>+</span><strong>Add photos</strong><small>Up to 5 photos</small></button>}
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
                    <p>写真そのものを解析し、この補足を「何があったか」の優先情報として英文を作ります。</p>
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
              <span className="button-step">2</span><span>{props.generating ? "Analyzing your photos…" : "Generate today's English"}</span><b>{props.generating ? "•" : "→"}</b>
            </button>
          </div>
          {props.generationError && <div className="generation-error" role="alert"><span>!</span><p><strong>Couldn&apos;t analyze these photos.</strong><small>{props.generationError}</small></p><button type="button" onClick={props.onGenerate}>Try again</button></div>}
        </section>

        <QuickReview
          item={props.reviewItem}
          answer={props.answer}
          feedback={props.feedback}
          soundEnabled={props.soundEnabled}
          onAnswer={props.onAnswer}
          onCheck={props.onCheck}
          onNext={props.onNext}
          onToggleSound={props.onToggleSound}
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

function QuickReview({ item, answer, feedback, soundEnabled, onAnswer, onCheck, onNext, onToggleSound, onOpenReview }: {
  item?: { entry: DailyEntry; expression: Expression };
  answer: string;
  feedback: Feedback;
  soundEnabled: boolean;
  onAnswer: (answer: string) => void;
  onCheck: () => void;
  onNext: () => void;
  onToggleSound: () => void;
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
            <input id="home-review-answer" value={answer} onChange={(event) => onAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { if (feedback) onNext(); else onCheck(); } }} placeholder="________" autoComplete="off" />
            <button type="button" onClick={feedback ? onNext : onCheck} disabled={!answer.trim()}>{feedback ? "Next" : "Check answer"}</button>
          </div>
          {feedback && (
            <div className={`inline-feedback ${feedback}`}>
              <span>{feedback === "correct" ? "✓" : "!"}</span>
              <p><strong>{feedback === "correct" ? "Correct!" : feedback === "almost" ? "Almost!" : "Try again"} <b>{item.expression.expression}</b></strong><small>{item.expression.example}</small></p>
            </div>
          )}
          <div className="quiz-footer">
            <button className="sound-toggle" type="button" onClick={onToggleSound} aria-pressed={soundEnabled} aria-label={`Quiz sounds ${soundEnabled ? "on" : "off"}`}><span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span>{soundEnabled ? "Sound on" : "Sound off"}</button>
            <button className="text-link" type="button" onClick={onOpenReview}>Open full review →</button>
          </div>
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
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function toggleNarration() {
    if (!("speechSynthesis" in window)) return;
    const synthesizer = window.speechSynthesis;
    if (speaking || synthesizer.speaking) {
      synthesizer.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(entry.diaryEnglish);
    const voice = synthesizer.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith("en-us"))
      ?? synthesizer.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synthesizer.cancel();
    synthesizer.speak(utterance);
    setSpeaking(true);
  }

  return (
    <section className="app-screen result-screen section-shell reveal">
      <div className="page-toolbar"><div><p className="kicker">{formatDay(entry.date)} · Generated</p><h1>Your day in English</h1><p>写真を見ると、その日の英語が思い出せる。</p></div><button className="secondary-action" type="button" onClick={onCreate}>+ Add another day</button></div>

      <article className="diary-summary">
        <div><span>DAY SUMMARY</span><button className={`diary-audio ${speaking ? "playing" : ""}`} type="button" onClick={toggleNarration} aria-pressed={speaking} aria-label={speaking ? "Stop reading the English diary" : "Listen to the English diary"}><b aria-hidden="true">{speaking ? "■" : "▶"}</b><small>{speaking ? "Stop" : "Listen"}</small></button></div>
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

function ReviewScreen({ item, answer, feedback, index, total, soundEnabled, onAnswer, onCheck, onNext, onToggleSound, onCreate }: {
  item?: { entry: DailyEntry; expression: Expression };
  answer: string;
  feedback: Feedback;
  index: number;
  total: number;
  soundEnabled: boolean;
  onAnswer: (answer: string) => void;
  onCheck: () => void;
  onNext: () => void;
  onToggleSound: () => void;
  onCreate: () => void;
}) {
  if (!item) return <EmptyState title="No review yet" body="今日の英語を保存すると、明日ここで復習できます。" onCreate={onCreate} />;
  const photo = item.entry.photos.find((candidate) => candidate.id === item.expression.photoId) ?? item.entry.photos[0];
  return (
    <section className="app-screen review-page section-shell reveal">
      <div className="page-toolbar"><div><p className="kicker">Daily recall · {Math.min(index + 1, total)} of {total}</p><h1>Review yesterday</h1><p>写真の記憶から、英語を思い出そう。</p></div><div className="review-tools"><button className="sound-toggle" type="button" onClick={onToggleSound} aria-pressed={soundEnabled} aria-label={`Quiz sounds ${soundEnabled ? "on" : "off"}`}><span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span>{soundEnabled ? "Sound on" : "Sound off"}</button><div className="review-meter"><span style={{ width: `${((index % Math.max(total, 1)) + 1) / Math.max(total, 1) * 100}%` }} /></div></div></div>
      <div className="review-workspace">
        <figure><img src={photo?.imageUrl} alt={photo?.label || "Memory for this question"} /><figcaption><span>{formatDay(item.entry.date, false)} · {photo?.time}</span><strong>{photo?.label}</strong></figcaption></figure>
        <div className="review-question">
          <span className="question-type">JAPANESE → ENGLISH</span>
          <h2>{item.expression.japanese}</h2>
          <p>{item.expression.cloze}</p>
          <label htmlFor="review-answer">Your answer</label>
          <input id="review-answer" className={feedback || ""} value={answer} onChange={(event) => onAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { if (feedback) onNext(); else onCheck(); } }} placeholder="Type it in English…" autoComplete="off" />
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
