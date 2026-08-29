/*
# Project:     lovemallacoota.au
# File Name:   prepare-article-image.mjs
# Description: One image per article, converted to WebP at 1280px on the longest
#              side, with its credit and rights recorded alongside. An image
#              without a credit is not accepted: the whole archive argument
#              rests on knowing where a picture came from.
#
# Usage:
#   node tools/prepare-article-image.mjs <photo> --week=2026-w35 \
#        --article=w35-local-frank-squires \
#        --credit="Geelong Advertiser, 23 March 1968" \
#        --alt="A PMG pontoon on the Barwon River" \
#        --note="Colourised from the original black and white print." \
#        --rights=permission_granted
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "images", "articles");

const LONGEST_EDGE = 1920;
const SMALL_EDGE = 800;
const RIGHTS = ["permission_granted", "own_work", "open_licence", "public_domain_verified", "review_required"];

const [source, ...rest] = process.argv.slice(2);
const args = new Set(rest);
const valueOf = (name) =>
  [...args].find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;

const week = valueOf("week");
const articleId = valueOf("article");
const credit = valueOf("credit");
const alt = valueOf("alt");
const rights = valueOf("rights") || "review_required";

if (!source || !existsSync(source) || !week || !articleId) {
  console.error("Usage: node tools/prepare-article-image.mjs <photo> --week=.. --article=.. --credit=.. --alt=..");
  process.exit(1);
}
if (!credit) {
  console.error("--credit is required. An uncredited photograph does not get published.");
  process.exit(1);
}
if (!alt) {
  console.error("--alt is required, so the picture means something to a screen reader.");
  process.exit(1);
}
if (!RIGHTS.includes(rights)) {
  console.error(`--rights must be one of: ${RIGHTS.join(", ")}`);
  process.exit(1);
}

const meta = await sharp(source).metadata();
console.log(`source ${path.basename(source)} — ${meta.width}×${meta.height} ${meta.format}`);

mkdirSync(outDir, { recursive: true });
// --slot=2 puts a second photograph on the same article rather than replacing
// the first.
const slot = Number(valueOf("slot") || 1);
const stem = slot > 1 ? `${articleId}-${slot}` : articleId;
const outFile = path.join(outDir, `${stem}.webp`);
const longest = valueOf("display") === "small" ? SMALL_EDGE : LONGEST_EDGE;
await sharp(source)
  .resize(longest, longest, { fit: "inside", withoutEnlargement: true })
  .webp({ quality: 84 })
  .toFile(outFile);

const written = await sharp(outFile).metadata();
console.log(`  wrote ${path.relative(rootDir, outFile)} — ${written.width}×${written.height}`);

const editionFile = path.join(rootDir, "data", "editions", `${week}.json`);
const edition = JSON.parse(readFileSync(editionFile, "utf8"));
const article = (edition.articles || []).find((entry) => entry.id === articleId);
if (!article) {
  console.error(`  ! no article ${articleId} in ${week}`);
  process.exit(1);
}

// --display=small keeps a low-resolution picture honest: shown at 44mm a
// 400px original prints near 230dpi, where full width would be 110.
const record = {
  url: `/images/articles/${stem}.webp`,
  alt,
  credit,
  note: valueOf("note") || null,
  rights,
  display: valueOf("display") || null,
};

if (slot > 1) {
  article.images = (article.images || []).filter((image) => image.url !== record.url);
  article.images.push(record);
} else {
  article.image = record;
}
delete article.imagePending;

writeFileSync(editionFile, `${JSON.stringify(edition, null, 2)}\n`, "utf8");
console.log(`  recorded on ${articleId} with rights: ${rights}`);
