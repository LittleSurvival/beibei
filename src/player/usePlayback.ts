import { useEffect, useRef, useState, type RefObject } from 'react';
import { archive, byDay, photoUrl } from '../archive';
import type { Effect } from './effects';
import { renderFrame, type PlayerImage } from './renderer';

type ImageState = { image: HTMLImageElement; status: 'loading' | 'ready' | 'error' };

export function usePlayback(
  canvas: RefObject<HTMLCanvasElement | null>,
  day: number,
  setDay: (day: number) => void,
  playing: boolean,
  pause: () => void,
  fps: number,
  effect: Effect,
  stabilized: boolean,
) {
  const cache = useRef(new Map<number, ImageState>());
  const lastDrawn = useRef<PlayerImage | undefined>(undefined);
  const nextAt = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState<ImageState['status'] | 'buffering'>('loading');

  useEffect(() => {
    if (!playing) nextAt.current = undefined;
    const photo = byDay.get(day);
    if (!photo) {
      setStatus('ready');
      return;
    }
    const index = archive.indexOf(photo);
    const lookahead = playing ? Math.max(12, fps) : 4;
    const nearby = archive.slice(Math.max(0, index - 2), index + 1 + lookahead);
    const keep = new Set(nearby.map((frame) => frame.day));
    for (const cachedDay of cache.current.keys()) {
      if (!keep.has(cachedDay)) cache.current.delete(cachedDay);
    }
    for (const frame of [photo, ...nearby]) {
      if (cache.current.has(frame.day)) continue;
      const image = new Image();
      if (frame === photo) image.fetchPriority = 'high';
      const entry: ImageState = { image, status: 'loading' };
      cache.current.set(frame.day, entry);
      image.src = photoUrl(frame);
      image.decode().then(() => { entry.status = 'ready'; }, () => { entry.status = 'error'; });
    }

    const frame = cache.current.get(day)!;
    const current = { image: frame.image, day };
    const previous = lastDrawn.current;
    const next = archive[index + 1];
    const nextFrame = next && cache.current.get(next.day);
    // Keep half a second ready before starting or recovering from a slow download.
    const reserve = archive.slice(index + 1, index + 1 + Math.ceil(fps / 2));
    const interval = 1000 / fps;
    let needsBuffer = nextAt.current === undefined;
    let bufferSince: number | undefined;
    let visibleAt: number | undefined;
    let buffering = false;
    let drawn = false;
    let raf: number;
    setStatus(frame.status);
    const tick = (now: number) => {
      if (frame.status === 'error') {
        setStatus('error');
        pause();
        return;
      }
      if (frame.status === 'ready') {
        if (visibleAt === undefined) {
          visibleAt = now;
          setStatus('ready');
          lastDrawn.current = current;
          if (playing && !needsBuffer) {
            // Carry the deadline across React renders to avoid rounding every frame
            // up to the next screen refresh. Never rush through a long overdue queue.
            nextAt.current = Math.max(nextAt.current!, now - interval) + interval;
          }
        }
        const elapsed = now - visibleAt;
        const progress = Math.min(elapsed / Math.min(260, 800 / fps), 1);
        if (canvas.current && !drawn) {
          renderFrame(canvas.current, current, previous, effect, progress, stabilized);
          drawn = effect === 'cut' || !previous || progress === 1;
        }
        if (playing) {
          if (needsBuffer) {
            bufferSince ??= now;
            if (reserve.every((photo) => cache.current.get(photo.day)?.status !== 'loading')) {
              needsBuffer = false;
              buffering = false;
              nextAt.current = now + interval;
              setStatus('ready');
            }
          } else if (now >= nextAt.current!) {
            if (!next) {
              pause();
              return;
            }
            if (nextFrame?.status !== 'loading') {
              setDay(next.day);
              return;
            }
            needsBuffer = true;
            nextAt.current = undefined;
            bufferSince = now;
          }
          if (needsBuffer && !buffering && now - bufferSince! >= 350) {
            buffering = true;
            setStatus('buffering');
          }
        }
        if (!playing && (effect === 'cut' || progress === 1)) return;
      }
      raf = requestAnimationFrame(tick);
    };
    tick(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [canvas, day, effect, fps, pause, playing, setDay, stabilized]);

  return status;
}
