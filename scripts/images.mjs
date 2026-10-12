/** Convert the supplied recovery library to responsive, GPU-friendly WebP. */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import sharp from 'sharp';

const SOURCE = 'artifacts/source-images/new_images/Images';
const OUTPUT = 'public/images/collection';
const MAX_DIMENSION = 1600;
const HERO_OUTPUT = 'public/images/hero';
const HERO_SOURCE = [
  'Cooling',
  'Blue',
  'u7982621818_A_real_glacier_landscape_photographed_in_soft_ove_434dea55-a114-47d6-a1e4-ff610a21d837_0.png',
];

async function imageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await imageFiles(path)));
    else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) files.push(path);
  }

  return files.sort();
}

function slug(path) {
  return relative(SOURCE, path)
    .replace(/\.[^.]+$/, '')
    .split(sep)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function imageInfo(path, dimensions) {
  const parts = relative(SOURCE, path).split(sep);
  const category = parts[0];
  const variant = parts.length > 2 ? parts[1] : category;
  const label = parts.at(-1).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const sourceNumber = label.match(/\d+/)?.[0];

  return {
    src: `/images/collection/${slug(path)}.webp`,
    category,
    variant,
    title: `${category} / ${variant}${sourceNumber ? ` / ${sourceNumber}` : ''}`,
    alt: `${variant} nature-inspired imagery from the Clean Ratio ${category.toLowerCase()} collection.`,
    ...dimensions,
  };
}

async function main() {
  await mkdir(OUTPUT, { recursive: true });
  const files = await imageFiles(SOURCE);
  if (files.length === 0) {
    console.error(`No images found in ${SOURCE}`);
    process.exitCode = 1;
    return;
  }

  const images = [];
  let totalBytes = 0;

  for (const input of files) {
    const output = join(OUTPUT, `${slug(input)}.webp`);
    const result = await sharp(input)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80, effort: 5 })
      .toFile(output);
    const metadata = await sharp(output).metadata();
    const image = imageInfo(input, {
      width: metadata.width,
      height: metadata.height,
    });

    images.push({ ...image, bytes: result.size });
    totalBytes += result.size;
  }

  await writeFile(
    join(OUTPUT, 'manifest.json'),
    JSON.stringify({ images }, null, 2),
  );

  await sharp(join(SOURCE, 'Cooling', 'pink salt.png'))
    .rotate()
    .resize(1200, 630, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82, effort: 5 })
    .toFile('public/og.webp');

  // The hero is one photograph, cut twice: a wide band for desktop and the
  // full portrait frame for phones. Cropped from the 1904 × 2544 original, not
  // from the 1600 px WebP, so the wide cut is not upscaled on a large screen.
  await mkdir(HERO_OUTPUT, { recursive: true });
  const hero = sharp(join(SOURCE, ...HERO_SOURCE)).rotate();
  const { width: heroW = 0, height: heroH = 0 } = await hero.metadata();
  const wideH = Math.round((heroW * 9) / 16);
  await hero
    .clone()
    // Centred on the ice arch, which sits a little under half way down.
    .extract({ left: 0, top: Math.round(heroH * 0.44 - wideH / 2), width: heroW, height: wideH })
    .webp({ quality: 78, effort: 5 })
    .toFile(join(HERO_OUTPUT, 'glacier-wide.webp'));
  await hero
    .clone()
    .resize({ width: 1200, height: 1600, fit: 'cover', position: 'centre' })
    .webp({ quality: 78, effort: 5 })
    .toFile(join(HERO_OUTPUT, 'glacier-tall.webp'));

  console.log(
    `Optimized ${images.length} images to ${(totalBytes / 1024 / 1024).toFixed(1)} MB of WebP.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
