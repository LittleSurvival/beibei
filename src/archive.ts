import entries from '../content/days.json';

export const archive = entries;
export const latest = archive[archive.length - 1];
export const byDay = new Map(archive.map((entry) => [entry.day, entry]));
export const gaps = Array.from({ length: Math.floor(latest.day) }, (_, i) => i + 1)
  .filter((day) => !byDay.has(day));

export type Photo = typeof latest;

export function photoUrl(photo: Photo) {
  return `${import.meta.env.BASE_URL}photos/${photo.image}`;
}

export function nearby(day: number) {
  const nextIndex = archive.findIndex((entry) => entry.day > day);
  if (nextIndex === -1) {
    return { previous: day === latest.day ? archive.at(-2) : latest, next: undefined };
  }
  const previousIndex = nextIndex - (byDay.has(day) ? 2 : 1);
  return { previous: archive[previousIndex], next: archive[nextIndex] };
}
