/**
 * Asset prep for public/images.
 *
 * Writes, for every source image:
 *   - a 1600 px WebP for the WebGL textures
 *   - a 600 px JPEG for the HTML fallback deck
 *
 * Both are cropped to 4:5 and given a warm, slightly low-contrast grade, so
 * the six read as one shoot. Heavy JPEGs are the most common reason this
 * effect stutters — the script warns about anything over 600 KB.
 *
 *   npm run images
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const SOURCE = 'public/images';
const OUT_LARGE = 'public/images/1600';
const OUT_SMALL = 'public/images/600';
const MAX_BYTES = 600 * 1024;
const ASPECT = 4 / 5;

const grade = (pipeline) =>
  pipeline
    // Warm, and a touch flatter than the original.
    .modulate({ saturation: 0.94, brightness: 1.02 })
    .tint({ r: 255, g: 250, b: 243 })
    .linear(0.94, 8);

async function main() {
  await mkdir(OUT_LARGE, { recursive: true });
  await mkdir(OUT_SMALL, { recursive: true });

  const files = (await readdir(SOURCE)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  if (files.length === 0) {
    console.error(`No images found in ${SOURCE}`);
    process.exitCode = 1;
    return;
  }

  const report = [];

  for (const file of files) {
    const { name } = parse(file);
    const input = join(SOURCE, file);
    const { size } = await stat(input);

    if (size > MAX_BYTES) {
      console.warn(
        `  ${file} is ${(size / 1024).toFixed(0)} KB — keep sources under 600 KB.`,
      );
    }

    const large = join(OUT_LARGE, `${name}.webp`);
    await grade(
      sharp(input).resize({
        width: Math.round(1600 * ASPECT),
        height: 1600,
        fit: 'cover',
        position: 'attention',
      }),
    )
      .webp({ quality: 82, effort: 5 })
      .toFile(large);

    const small = join(OUT_SMALL, `${name}.jpg`);
    await grade(
      sharp(input).resize({
        width: Math.round(600 * ASPECT),
        height: 600,
        fit: 'cover',
        position: 'attention',
      }),
    )
      .jpeg({ quality: 78, progressive: true, mozjpeg: true })
      .toFile(small);

    const [l, s] = await Promise.all([stat(large), stat(small)]);
    report.push({ file, webp: l.size, jpeg: s.size });
    console.log(
      `  ${file} → ${(l.size / 1024).toFixed(0)} KB webp, ${(s.size / 1024).toFixed(0)} KB jpeg`,
    );
  }

  await writeFile(
    join(SOURCE, 'manifest.json'),
    JSON.stringify({ generated: new Date().toISOString(), images: report }, null, 2),
  );

  const total = report.reduce((sum, r) => sum + r.webp, 0);
  console.log(`\n  ${report.length} images, ${(total / 1024).toFixed(0)} KB of textures.`);
  console.log(`  Point lib/content.ts at ${OUT_LARGE}/<name>.webp when you are happy.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
