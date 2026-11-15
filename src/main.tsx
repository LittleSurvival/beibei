import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import { archive, byDay, gaps, latest, nearby } from './archive';
import { usePlayback } from './player/usePlayback';
import type { Effect } from './player/effects';
import './styles.css';

function readDay() {
  const raw = new URLSearchParams(location.search).get('day');
  if (!raw) return latest.day;
  const day = Number(raw);
  return byDay.has(day) || gaps.includes(day) ? day : latest.day;
}

function App() {
  const [day, setDay] = useState(readDay);
  const [query, setQuery] = useState(String(day));
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(24);
  const [effect, setEffect] = useState<Effect>('cut');
  const [stabilized, setStabilized] = useState(true);
  const [reversed, setReversed] = useState(false);
  const pause = useCallback(() => setPlaying(false), []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const settings = useRef<HTMLDialogElement>(null);
  const reducedMotion = useReducedMotion();
  const status = usePlayback(canvas, day, setDay, playing, pause, fps, reducedMotion ? 'cut' : effect, stabilized, reversed);
  const selected = byDay.get(day);
  const { previous, next } = nearby(day);

  useEffect(() => {
    if (playing) return;
    setQuery(String(day));
    const url = new URL(location.href);
    url.searchParams.set('day', String(day));
    history.replaceState(null, '', url);
  }, [day, playing]);

  function seek(target: number) {
    pause();
    setDay(target);
    setQuery(String(target));
    setError('');
  }

  function jump(event: FormEvent) {
    event.preventDefault();
    const target = Number(query.trim());
    if (byDay.has(target) || gaps.includes(target)) {
      seek(target);
      settings.current?.close();
    } else setError(`請輸入 1 至 ${latest.day}，或有紀錄的加更編號。`);
  }

  function toggle() {
    if (playing) {
      pause();
      return;
    }
    if (reversed) {
      if (day <= archive[0].day) setDay(latest.day);
      else if (!selected && previous) setDay(previous.day);
    } else {
      if (day >= latest.day) setDay(archive[0].day);
      else if (!selected && next) setDay(next.day);
    }
    setPlaying(true);
  }

  return (
    <MotionConfig reducedMotion="user">
      <header className="top"><a href="./" className="brand"><span className="dot" /> 被被觀察日記</a>
        <button type="button" className="icon-button" aria-label="設定" aria-haspopup="dialog"
          onClick={() => { pause(); setError(''); settings.current?.showModal(); }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.5 3h5l.6 2.3 1.3.8 2.3-.6 2.5 4.3-1.7 1.7v1.5l1.7 1.7-2.5 4.3-2.3-.6-1.3.8-.6 2.3h-5l-.6-2.3-1.3-.8-2.3.6-2.5-4.3 1.7-1.7v-1.5L2.8 9.8l2.5-4.3 2.3.6 1.3-.8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </header>
      <main className="hero" id="archive">
        <h1>被被還在。</h1>
        <motion.figure className="hero-image" initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div className="frame">
            <canvas width={480} height={640} ref={canvas} hidden={!selected}
              role="img" aria-label={`Day ${day} 的被被照片`} />
            {!selected && <div className="frame-message"><small>目前未找到這天的照片</small></div>}
            {selected && status === 'loading' && <div className="frame-message"><small>載入照片中…</small></div>}
            {selected && status === 'buffering' && <span className="buffering" role="status">緩衝中…</span>}
            {selected && status === 'error' && <div className="frame-message"><small>這張照片載入失敗</small></div>}
          </div>
          <figcaption>
            <strong>Day {day}</strong>
            {selected && <time dateTime={selected.date}>{selected.date}</time>}
          </figcaption>
        </motion.figure>
        <div className="controls">
          <div className="transport">
            <button onClick={() => previous && seek(previous.day)} disabled={!previous}
              aria-label="上一張">←</button>
            <button className="primary" onClick={toggle}>{playing ? '暫停' : reversed ? '倒放縮時' : '播放縮時'}</button>
            <button onClick={() => next && seek(next.day)} disabled={!next}
              aria-label="下一張">→</button>
          </div>
          <div className="timeline">
            <div className="ticks" aria-hidden="true">{gaps.map((gap) =>
              <i key={gap} style={{ left: `${100 * (gap - 1) / (latest.day - 1)}%` }} />)}</div>
            <input aria-label="照片時間軸" aria-valuetext={`Day ${day}`} type="range" min="1"
              max={latest.day} step="1" value={Math.floor(day)} onChange={(e) => seek(+e.target.value)} />
            <div className="range-labels"><span>Day 1</span><span>Day {latest.day}</span></div>
          </div>
          <nav className="photo-links" aria-label="延伸閱讀">
            {selected && (
              <a className="source icon-link" href={selected.url} target="_blank" rel="noreferrer"
                aria-label="Threads 原文" title="Threads 原文">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z" />
                </svg>
                <span aria-hidden="true">↗</span>
              </a>
            )}
            <a className="source icon-link" href="https://github.com/LittleSurvival/beibei" target="_blank"
              rel="noreferrer" aria-label="GitHub 專案" title="GitHub 專案">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              <span aria-hidden="true">↗</span>
            </a>
            <a className="source" href={`./history.html?day=${day}`}>歷史事件 →</a>
          </nav>
        </div>
      </main>
      <dialog ref={settings} aria-labelledby="settings-title">
        <div className="dialog-heading">
          <h2 id="settings-title">設定</h2>
          <button type="button" className="icon-button" aria-label="關閉設定"
            onClick={() => settings.current?.close()}>×</button>
        </div>
        <div className="settings">
          <label className="settings-toggle"><input type="checkbox" checked={stabilized}
            onChange={(e) => setStabilized(e.target.checked)} />畫面穩定</label>
          <label className="settings-toggle"><input type="checkbox" checked={reversed}
            onChange={(e) => setReversed(e.target.checked)} />倒放（由新到舊）</label>
          <div className="speed-setting">
            <label htmlFor="playback-speed">速度</label>
            <output htmlFor="playback-speed">{fps} 張／秒</output>
            <input id="playback-speed" type="range" min={2} max={48} step={1} value={fps}
              aria-valuetext={`${fps} 張／秒`} onChange={(e) => setFps(e.target.valueAsNumber)} />
          </div>
          <label>轉場 <select disabled={!!reducedMotion} value={reducedMotion ? 'cut' : effect}
            onChange={(e) => setEffect(e.target.value as Effect)}>
            <option value="cut">直接切換</option><option value="fade">交叉淡化</option>
          </select></label>
        </div>
        <form className="jump" onSubmit={jump}>
          <label htmlFor="day-query">跳到 Day</label>
          <input id="day-query" inputMode="decimal" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit">前往</button>
        </form>
        {error && <p role="alert" className="error">{error}</p>}
        <details className="gaps"><summary>查閱缺口（{gaps.length} 天）</summary>
          <div>{gaps.map((gap) => <button key={gap} onClick={() => {
            seek(gap);
            settings.current?.close();
          }}>Day {gap}</button>)}</div>
        </details>
      </dialog>
    </MotionConfig>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
