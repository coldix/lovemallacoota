/*
# Project:     lovemallacoota.au
# File Name:   prepare-bank.mjs
# Description: Adds a photograph to the filler bank at 1920px on the longest
#              side. The bank fills the space a short edition leaves, so every
#              picture needs a caption and a credit like any other.
#
# Usage:
#   node tools/prepare-bank.mjs <photo> --slug=bastion-point \
#        --caption="Bastion Point" --credit="Colin Dixon"
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bankDir = path.join(rootDir, "images", "bank");
const bankFile = path.join(rootDir, "data", "photo-bank.json");
const LONGEST_EDGE = 1920;

const [source, ...rest] = process.argv.slice(2);
const args = new Set(rest);
const valueOf = (name) =>
  [...args].find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;

const slug = valueOf("slug");
const caption = valueOf("caption");
const credit = valueOf("credit");

if (!source || !existsSync(source) || !slug || !caption || !credit) {
  console.error("Usage: node tools/prepare-bank.mjs <photo> --slug=.. --caption=.. --credit=..");
  process.exit(1);
}

mkdirSync(bankDir, { recursive: true });
const outFile = path.join(bankDir, `${slug}.webp`);
await sharp(source)
  .resize(LONGEST_EDGE, LONGEST_EDGE, { fit: "inside", withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(outFile);

const written = await sharp(outFile).metadata();
const bank = existsSync(bankFile) ? JSON.parse(readFileSync(bankFile, "utf8")) : [];
const entry = {
  slug,
  url: `/images/bank/${slug}.webp`,
  alt: valueOf("alt") || caption,
  caption,
  credit,
  orientation: written.width >= written.height ? "landscape" : "portrait",
};

const existing = bank.findIndex((photo) => photo.slug === slug);
if (existing >= 0) bank[existing] = entry;
else bank.push(entry);

writeFileSync(bankFile, `${JSON.stringify(bank, null, 2)}\n`);
console.log(`${slug}: ${written.width}×${written.height} ${entry.orientation} — bank now holds ${bank.length}`);
