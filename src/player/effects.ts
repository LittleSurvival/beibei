export type Effect = 'cut' | 'fade';
export type DrawFrame = (image: HTMLImageElement, opacity?: number) => void;

export const effects: Record<Effect, (
  draw: DrawFrame, current: HTMLImageElement, previous: HTMLImageElement | undefined, progress: number,
) => void> = {
  cut: (draw, current) => draw(current),
  fade(draw, current, previous, progress) {
    if (previous && progress < 1) {
      draw(previous);
      draw(current, progress);
    } else {
      draw(current);
    }
  },
};
