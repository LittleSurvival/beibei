import { cp, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const archive = JSON.parse(await readFile('content/days.json', 'utf8'));
const photos = 'fangyi-timelapse/photos';
const paths = new Set();
let previous = 0;

for (const entry of archive) {
  const { day, date, image, url } = entry;
  if (!Number.isFinite(day) || day <= previous || !Number.isInteger(day * 2)) {
    throw new Error(`Invalid, duplicated, or unsorted Day ${day}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) {
    throw new Error(`Invalid date for Day ${day}`);
  }
  if (url !== null && !/^https:\/\/www\.threads\.com\/@fangyi_0923\/post\/[\w-]+$/.test(url)) {
    throw new Error(`Invalid source for Day ${day}`);
  }
  if (!/^day[\d.]+-day[\d.]+\/day[\d.]+\.jpg$/.test(image)
    || image.split('/')[1] !== `day${day}.jpg` || paths.has(image)) {
    throw new Error(`Invalid image path for Day ${day}`);
  }
  paths.add(image);
  previous = day;
}

for (const folder of await readdir(photos, { withFileTypes: true })) {
  if (!folder.isDirectory() || folder.name === 'misc') continue;
  for (const name of await readdir(join(photos, folder.name))) {
    if (name.endsWith('.jpg') && !paths.delete(`${folder.name}/${name}`)) {
      throw new Error(`Unindexed photo: ${folder.name}/${name}`);
    }
  }
  if (process.argv.includes('--copy')) {
    await cp(join(photos, folder.name), join('dist/photos', folder.name), {
      recursive: true,
      filter: (source) => source === join(photos, folder.name) || source.endsWith('.jpg'),
    });
  }
}
if (!archive.length || paths.size) throw new Error(`Missing archive files: ${[...paths].join(', ')}`);
console.log(`Validated ${archive.length} photos through Day ${previous}`);
