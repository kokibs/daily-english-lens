"use client";

/* eslint-disable @next/next/no-img-element -- Saved user photos may be data URLs. */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { albumMonthLabel, albumStoryFrames, type MonthlyAlbum } from "../lib/monthly-albums";

function frameDuration(english: string) {
  const words = english.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(10_000, Math.max(5_500, words * 420));
}

export default function MonthlyAlbumFilm({ album, onClose }: { album: MonthlyAlbum; onClose: () => void }) {
  const frames = useMemo(() => albumStoryFrames(album), [album]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const frame = frames[index];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        setIndex((current) => Math.max(0, Math.min(frames.length - 1, current + direction)));
        setFinished(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [frames.length, onClose]);

  function move(direction: -1 | 1) {
    setIndex((current) => Math.max(0, Math.min(frames.length - 1, current + direction)));
    setFinished(false);
  }

  function togglePlayback() {
    if (finished) {
      setIndex(0);
      setFinished(false);
      setReplayCount((current) => current + 1);
      setPlaying(true);
      return;
    }
    setPlaying((current) => !current);
  }

  function advance() {
    if (index < frames.length - 1) {
      setIndex(index + 1);
    } else {
      setPlaying(false);
      setFinished(true);
    }
  }

  const duration = frame ? frameDuration(frame.english) : 5_500;
  const progressStyle = { "--film-duration": `${duration}ms`, "--film-position": `${index / Math.max(frames.length, 1) * 100}%`, "--film-step": `${100 / Math.max(frames.length, 1)}%` } as CSSProperties;

  return (
    <div className="album-film-backdrop">
      <section
        className="album-film"
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-film-title"
      >
        <header className="album-film-header">
          <div><span>YOUR MONTH IN ENGLISH</span><h2 id="album-film-title">{albumMonthLabel(album.month)}の思い出</h2></div>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="思い出ムービーを閉じる">×</button>
        </header>

        {frame ? (
          <>
            <div className={`album-film-stage ${playing ? "" : "paused"}`} style={progressStyle}>
              {frame.photo.imageUrl
                ? <>
                    <img className="album-film-image-backdrop" key={`backdrop-${frame.id}`} src={frame.photo.imageUrl} alt="" aria-hidden="true" />
                    <img className="album-film-image" key={`${frame.id}:${replayCount}`} src={frame.photo.imageUrl} alt={frame.photo.label || `${frame.date}の写真`} />
                  </>
                : <div className="album-film-image-placeholder" aria-hidden="true">✶</div>}
              <div className="album-film-shade" />
              <div className="album-film-progress" aria-label={`${index + 1} / ${frames.length}枚目`}>
                <span className="album-film-progress-past" />
                <span
                  key={`${frame.id}:${replayCount}`}
                  className={`album-film-progress-current ${playing ? "playing" : "paused"}`}
                  onAnimationEnd={playing ? advance : undefined}
                />
              </div>
              <div className="album-film-caption" key={`caption-${frame.id}`}>
                <span>{frame.date.replaceAll("-", ".")} · {index + 1} / {frames.length}</span>
                <p lang="en">{frame.english}</p>
                {frame.japanese && <small>{frame.japanese}</small>}
              </div>
              {finished && <div className="album-film-finished"><span>✶</span><strong>{albumMonthLabel(album.month)}を振り返りました</strong><p>写真も英文も、いつでもアルバムから見返せます。</p></div>}
            </div>
            <div className="album-film-controls">
              <button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="前の写真">←</button>
              <button className="album-film-play" type="button" onClick={togglePlayback} aria-label={finished ? "最初から再生" : playing ? "一時停止" : "再生"}>{finished ? "↻ もう一度見る" : playing ? "Ⅱ 一時停止" : "▶ 再生"}</button>
              <button type="button" onClick={() => move(1)} disabled={index === frames.length - 1} aria-label="次の写真">→</button>
            </div>
          </>
        ) : (
          <div className="album-film-empty">この月に再生できる写真はありません。</div>
        )}
      </section>
    </div>
  );
}
