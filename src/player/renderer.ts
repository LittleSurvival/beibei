import { effects, type DrawFrame, type Effect } from './effects';
import transforms from '../../content/stabilization.json';

export type PlayerImage = { image: HTMLImageElement; day: number };

const alignment: Record<string, number[]> = transforms;

export function renderFrame(
  canvas: HTMLCanvasElement,
  current: PlayerImage,
  previous: PlayerImage | undefined,
  effect: Effect,
  progress: number,
  stabilized: boolean,
) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.fillStyle = '#10130f';
  context.fillRect(0, 0, width, height);

  const draw: DrawFrame = (image, opacity = 1) => {
    const day = image === current.image ? current.day : previous?.day;
    const matrix = stabilized && day !== undefined ? alignment[day] : undefined;
    context.globalAlpha = opacity;
    if (matrix) {
      const [a, b, c, d, e, f] = matrix;
      context.save();
      context.scale(width / 480, height / 640);
      context.transform(a, d, b, e, c, f);
      context.drawImage(image, 0, 0, 480, 640);
      context.restore();
      context.globalAlpha = 1;
      return;
    }
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
    context.globalAlpha = 1;
  };
  effects[effect](draw, current.image, previous?.image, progress);
}
