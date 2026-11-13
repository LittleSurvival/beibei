import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import { archive, byDay, gaps, latest, nearby, photoUrl } from './archive';
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
  const [fps, setFps] = useState(6);
  const [effect, setEffect] = useState<Effect>('cut');
  const pause = useCallback(() => setPlaying(false), []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const status = usePlayback(canvas, day, setDay, playing, pause, fps, reducedMotion ? 'cut' : effect);
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
    if (byDay.has(target) || gaps.includes(target)) seek(target);
    else setError(`請輸入 1 至 ${latest.day}，或有紀錄的加更編號。`);
  }

  function openPlayer(play: boolean) {
    seek(archive[0].day);
    setPlaying(play);
    player.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
    player.current?.focus({ preventScroll: true });
  }

  function toggle() {
    if (playing) {
      pause();
      return;
    }
    if (day >= latest.day) setDay(archive[0].day);
    else if (!selected && next) setDay(next.day);
    setPlaying(true);
  }

  return (
    <MotionConfig reducedMotion="user">
      <header className="top"><a href="./" className="brand"><span className="dot" /> 被被觀察日記</a>
        <a className="top-link" href="#archive">照片紀錄 <span aria-hidden="true">↘</span></a>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker">屋簷上的被被</p>
            <h1>被被還在。</h1>
            <p className="lede">從 Day 1 開始，看一條卡在屋簷上的被子，怎麼度過這 {latest.day} 天。</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => openPlayer(true)}>▶　播放縮時</button>
              <button className="secondary" onClick={() => openPlayer(false)}>從 Day 1 看起 ↗</button>
            </div>
          </div>
          <motion.figure className="hero-image" initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <img src={photoUrl(latest)} alt={`Day ${latest.day} 的被被，掛在磚牆外的屋簷邊`} fetchPriority="high" />
            <figcaption><strong>Day {latest.day}</strong><span>{latest.date}</span></figcaption>
          </motion.figure>
        </section>

        <section className="archive" id="archive" ref={player} tabIndex={-1}>
          <div className="section-title"><h2>每日紀錄</h2><span>{archive.length} 張照片 · {gaps.length} 天缺口</span></div>
          <div className="viewer">
            <div className="frame">
              <canvas width={480} height={640} ref={canvas} hidden={!selected}
                role="img" aria-label={`Day ${day} 的被被照片`} />
              {!selected && <div className="frame-message">Day {day}<small>目前未找到這天的照片</small></div>}
              {selected && status === 'loading' && <div className="frame-message"><small>載入照片中…</small></div>}
              {selected && status === 'error' && <div className="frame-message"><small>這張照片載入失敗</small></div>}
            </div>
            <div className="controls">
              <div className="frame-title"><h3>Day {day}</h3>
                {selected && <time dateTime={selected.date}>{selected.date}</time>}
              </div>
              <div className="transport">
                <button onClick={() => previous && seek(previous.day)} disabled={!previous}
                  aria-label="上一張">←</button>
                <button className="primary play" onClick={toggle}>{playing ? '暫停' : '播放'}</button>
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
              <div className="settings">
                <label>速度 <select value={fps} onChange={(e) => setFps(+e.target.value)}>
                  <option value="2">2 張／秒</option><option value="6">6 張／秒</option>
                  <option value="12">12 張／秒</option><option value="24">24 張／秒</option>
                </select></label>
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
              {selected ? <a className="source" href={selected.url} target="_blank" rel="noreferrer">Threads 原文 ↗</a>
                : <div className="neighbors">
                  {previous && <button onClick={() => seek(previous.day)}>← Day {previous.day}</button>}
                  {next && <button onClick={() => seek(next.day)}>Day {next.day} →</button>}
                </div>}
            </div>
          </div>
          <details className="gaps"><summary>查閱缺口（{gaps.length} 天）</summary>
            <div>{gaps.map((gap) => <button key={gap} onClick={() => seek(gap)}>Day {gap}</button>)}</div>
          </details>
        </section>
      </main>
      <footer>照片來源 <a href="https://www.threads.com/@fangyi_0923" target="_blank" rel="noreferrer">@fangyi_0923 ↗</a></footer>
    </MotionConfig>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
