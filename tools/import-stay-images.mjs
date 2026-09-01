import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const repoRoot = '/Users/dixon/web/lovemallacoota';

const stayImages = [
  {
    source: path.join(repoRoot, 'images/SilverBream.jpg'),
    target: path.join(repoRoot, 'images/bus/acc/acc15-silver-bream-motel-flats1.webp')
  },
  {
    source: path.join(repoRoot, 'images/BrucesFlats.JPG'),
    target: path.join(repoRoot, 'images/bus/acc/acc06-bruces-waterside-units1.webp')
  }
];

async function convertStayImages() {
  for (const item of stayImages) {
    if (!fs.existsSync(item.source)) {
      console.error(`Source missing: ${item.source}`);
      continue;
    }
    const destDir = path.dirname(item.target);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    await sharp(item.source)
      .resize({ width: 1280, height: 960, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(item.target);
    console.log(`✓ Converted: ${path.basename(item.source)} -> ${path.relative(repoRoot, item.target)}`);
  }
}

convertStayImages();
