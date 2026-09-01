import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const repoRoot = '/Users/dixon/web/lovemallacoota';

const files = [
  {
    src: path.join(repoRoot, 'uploads/2026-w36-editorial-bringing-mallacoota-s-literary-history-to-life-henry-lawson-.jpg'),
    dest: path.join(repoRoot, 'images/articles/w36-lawson-1.webp')
  },
  {
    src: path.join(repoRoot, 'uploads/2026-w36-editorial-bringing-mallacoota-s-literary-history-to-life-henry-lawson--2.webp'),
    dest: path.join(repoRoot, 'images/articles/w36-lawson-2.webp')
  }
];

async function convert() {
  for (const item of files) {
    console.log(`Processing ${item.src}...`);
    await sharp(item.src)
      .resize({ width: 1920, height: 1440, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(item.dest);
    console.log(`✓ Created: ${path.relative(repoRoot, item.dest)}`);
  }
}

convert().catch(console.error);
