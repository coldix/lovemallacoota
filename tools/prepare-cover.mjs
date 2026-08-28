/*
# Project:     lovemallacoota.au
# File Name:   prepare-cover.mjs
# Description: Turns one photograph into the two derivatives a weekly edition
#              needs: a 300 dpi A4 portrait crop for the printed cover, and a
#              1600px WebP for the web. Records them on the edition so the
#              masthead and the PDF pick them up.
#
# Usage:
#   node tools/prepare-cover.mjs <photo> --week=2026-w35 \
#        --caption="Bastion Point after the swell" --credit="Colin Dixon"
*/

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coversDir = path.join(rootDir, "images", "covers");

/** A4 portrait at 300 dpi. 210 × 297 mm. */
const PRINT = { width: 2480, height: 3508 };
/** Screen only — the page should not carry a print-sized file. */
const WEB_WIDTH = 1600;
/** Below this the printed cover starts to look soft at A4. */
const MIN_SHORT_EDGE = 1754;

const [source, ...rest] = process.argv.slice(2);
const args = new Set(rest);
const valueOf = (name) =>
  [...args].find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;

if (!source || !existsSync(source)) {
  console.error("Usage: node tools/prepare-cover.mjs <photo> --week=YYYY-Www [--caption=..] [--credit=..]");
  process.exit(1);
}

const week = valueOf("week");
if (!week) {
  console.error("--week=YYYY-Www is required");
  process.exit(1);
}

const image = sharp(source, { failOn: "error" });
const meta = await image.metadata();
const shortEdge = Math.min(meta.width, meta.height);

console.log(`source ${path.basename(source)} — ${meta.width}×${meta.height} ${meta.format}`);
if (meta.width > meta.height) {
  console.warn(
    "  ! landscape source: an A4 portrait cover will crop away roughly a third of the frame"
  );
}
if (shortEdge < MIN_SHORT_EDGE) {
  console.warn(
    `  ! short edge ${shortEdge}px is below ${MIN_SHORT_EDGE}px — the printed cover will look soft at A4`
  );
} else {
  const dpi = Math.round((shortEdge / 210) * 25.4);
  console.log(`  print resolution at A4 width: about ${dpi} dpi`);
}

mkdirSync(coversDir, { recursive: true });
const printFile = path.join(coversDir, `${week}-print.jpg`);
const webFile = path.join(coversDir, `${week}.webp`);

// Attention-based crop keeps the horizon and the subject rather than the
// geometric middle, which on a coastal shot is usually empty water.
await sharp(source)
  .resize(PRINT.width, PRINT.height, { fit: "cover", position: sharp.strategy.attention })
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(printFile);

await sharp(source)
  .resize(WEB_WIDTH, null, { withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(webFile);

const editionFile = path.join(rootDir, "data", "editions", `${week}.json`);
if (existsSync(editionFile)) {
  const edition = JSON.parse(readFileSync(editionFile, "utf8"));
  edition.cover = {
    web: `/images/covers/${week}.webp`,
    print: `/images/covers/${week}-print.jpg`,
    caption: valueOf("caption") || edition.cover?.caption || null,
    credit: valueOf("credit") || edition.cover?.credit || null,
  };
  writeFileSync(editionFile, `${JSON.stringify(edition, null, 2)}\n`);
  console.log(`  recorded on data/editions/${week}.json`);
} else {
  console.warn(`  ! no edition at data/editions/${week}.json — files written, nothing recorded`);
}

for (const file of [printFile, webFile]) {
  const { width, height } = await sharp(file).metadata();
  console.log(`  wrote ${path.relative(rootDir, file)} — ${width}×${height}`);
}
