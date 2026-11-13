import { useEffect, useRef, useState, type RefObject } from 'react';
import { archive, byDay, photoUrl } from '../archive';
import type { Effect } from './effects';
import { renderFrame } from './renderer';

type ImageState = { image: HTMLImageElement; status: 'loading' | 'ready' | 'error' };

export function usePlayback(
  canvas: RefObject<HTMLCanvasElement | null>,
  day: number,
  setDay: (day: number) => void,
  playing: boolean,
  pause: () => void,
  fps: number,
  effect: Effect,
) {
  const cache = useRef(new Map<number, ImageState>());
  const lastDrawn = useRef<HTMLImageElement | undefined>(undefined);
  const [status, setStatus] = useState<ImageState['status']>('loading');

  useEffect(() => {
    const photo = byDay.get(day);
    if (!photo) {
      setStatus('ready');
      return;
    }
    const index = archive.indexOf(photo);
    const nearby = archive.slice(Math.max(0, index - 2), index + 13);
    const keep = new Set(nearby.map((frame) => frame.day));
    for (const cachedDay of cache.current.keys()) {
      if (!keep.has(cachedDay)) cache.current.delete(cachedDay);
    }
    for (const frame of [photo, ...nearby]) {
      if (cache.current.has(frame.day)) continue;
      const image = new Image();
      const entry: ImageState = { image, status: 'loading' };
      cache.current.set(frame.day, entry);
      image.src = photoUrl(frame);
      image.decode().then(() => { entry.status = 'ready'; }, () => { entry.status = 'error'; });
    }

    const frame = cache.current.get(day)!;
    const previous = lastDrawn.current;
    let visibleAt: number | undefined;
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
          lastDrawn.current = frame.image;
        }
        const elapsed = now - visibleAt;
        const progress = Math.min(elapsed / Math.min(260, 800 / fps), 1);
        if (canvas.current) renderFrame(canvas.current, frame.image, previous, effect, progress);
        if (playing && elapsed >= 1000 / fps) {
          const next = archive[index + 1];
          if (next) setDay(next.day);
          else pause();
          return;
        }
        if (!playing && (effect === 'cut' || progress === 1)) return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canvas, day, effect, fps, pause, playing, setDay]);

  return status;
}
