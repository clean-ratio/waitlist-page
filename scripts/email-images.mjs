// Builds the confirmation email's images into public/email/, served from
// https://clean-ratio.com/email/. Run with `node scripts/email-images.mjs`
// after changing a source image, then deploy the site.
//
// Every size comes from a 600px column split by the golden ratio:
// 600 = 371 + 229, and 371 / 229 ≈ 229 / 142 ≈ φ. Files are 2x for sharp
// screens. JPEG, not WebP, because desktop Outlook cannot show WebP.

import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'public/email';
const PAPER = '#f8f7f1';

const jobs = [
  // 600 x 371: the glacier arch and the breaking ice below it.
  {
    out: 'hero.jpg',
    src: 'public/images/hero/glacier-tall.webp',
    run: (img) => img.extract({ left: 0, top: 180, width: 1200, height: 742 }),
  },
];

mkdirSync(OUT, { recursive: true });

for (const { out, src, run } of jobs) {
  await run(sharp(src)).jpeg({ quality: 78, progressive: true, mozjpeg: true }).toFile(`${OUT}/${out}`);
  console.log(`${OUT}/${out}`);
}

// The wordmark, 2x of its widest use (229px). Flattened onto the paper colour
// so it stays legible when a mail app forces dark mode.
await sharp('public/logo_files/Black_wordmark.png')
  .trim()
  .resize(458)
  .flatten({ background: PAPER })
  .png({ compressionLevel: 9, palette: true })
  .toFile(`${OUT}/wordmark.png`);
console.log(`${OUT}/wordmark.png`);
