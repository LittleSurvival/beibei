import { effects, type DrawFrame, type Effect } from './effects';

export function renderFrame(
  canvas: HTMLCanvasElement,
  current: HTMLImageElement,
  previous: HTMLImageElement | undefined,
  effect: Effect,
  progress: number,
) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.fillStyle = '#10130f';
  context.fillRect(0, 0, width, height);

  const draw: DrawFrame = (image, opacity = 1) => {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    context.globalAlpha = opacity;
    context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
    context.globalAlpha = 1;
  };
  effects[effect](draw, current, previous, progress);
}
