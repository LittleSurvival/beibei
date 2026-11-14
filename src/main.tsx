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
            {selected && <a className="source" href={selected.url} target="_blank" rel="noreferrer">Threads 原文 ↗</a>}
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
