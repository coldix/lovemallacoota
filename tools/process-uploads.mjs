/*
# Project:     lovemallacoota.au
# File Name:   process-uploads.mjs
# Description: Converts photographs submitted through the form. The Worker
#              cannot resize an image, so it commits the original into
#              uploads/ with a sidecar describing it; this runs in CI, writes a
#              1920px WebP, records it on the article or the edition cover, and
#              removes the original.
#
# Usage: node tools/process-uploads.mjs
*/

import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadsDir = path.join(rootDir, "uploads");
const articlesDir = path.join(rootDir, "images", "articles");
const coversDir = path.join(rootDir, "images", "covers");

/** Submitted photographs are for the web, so one size is enough. */
const LONGEST_EDGE = 1920;
/** A4 portrait at 300 dpi, for the printed cover. */
const PRINT = { width: 2480, height: 3508 };

if (!existsSync(uploadsDir)) {
  console.log("Nothing to process.");
  process.exit(0);
}

const sidecars = readdirSync(uploadsDir).filter((file) => file.endsWith(".json"));
if (!sidecars.length) {
  console.log("Nothing to process.");
  process.exit(0);
}

let processed = 0;

for (const sidecarName of sidecars) {
  const sidecarPath = path.join(uploadsDir, sidecarName);
  const meta = JSON.parse(readFileSync(sidecarPath, "utf8"));
  const source = path.join(uploadsDir, meta.file);

  if (!existsSync(source)) {
    console.warn(`! ${meta.file} is missing; leaving ${sidecarName} in place`);
    continue;
  }

  if (meta.kind === "listing") {
    const listingsDir = path.join(rootDir, "images", "listings");
    mkdirSync(listingsDir, { recursive: true });
    await sharp(source)
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(path.join(listingsDir, `${meta.slug}.webp`));
    console.log(`listing photo for ${meta.slug}`);
    rmSync(source);
    rmSync(sidecarPath);
    processed += 1;
    continue;
  }

  const editionFile = path.join(rootDir, "data", "editions", `${meta.week}.json`);
  if (!existsSync(editionFile)) {
    console.warn(`! no edition ${meta.week}; leaving ${sidecarName} in place`);
    continue;
  }
  const edition = JSON.parse(readFileSync(editionFile, "utf8"));

  if (meta.kind === "cover") {
    mkdirSync(coversDir, { recursive: true });
    await sharp(source)
      .resize(PRINT.width, PRINT.height, { fit: "cover", position: sharp.strategy.attention })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(path.join(coversDir, `${meta.week}-print.jpg`));
    await sharp(source)
      .resize(LONGEST_EDGE, null, { withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(coversDir, `${meta.week}.webp`));

    edition.cover = {
      web: `/images/covers/${meta.week}.webp`,
      print: `/images/covers/${meta.week}-print.jpg`,
      caption: meta.caption || null,
      credit: meta.credit || null,
      submittedBy: meta.submittedBy || null,
    };
    console.log(`cover for ${meta.week} — ${meta.credit || "no credit"}`);
  } else {
    const article = (edition.articles || []).find((entry) => entry.id === meta.articleId);
    if (!article) {
      console.warn(`! no article ${meta.articleId} in ${meta.week}; leaving ${sidecarName}`);
      continue;
    }
    mkdirSync(articlesDir, { recursive: true });
    await sharp(source)
      .resize(LONGEST_EDGE, LONGEST_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(path.join(articlesDir, `${meta.articleId}.webp`));

    article.image = {
      url: `/images/articles/${meta.articleId}.webp`,
      alt: meta.alt || meta.caption || article.title,
      credit: meta.credit || meta.submittedBy || "Supplied",
      note: meta.caption || null,
      rights: meta.rights || "review_required",
    };
    console.log(`image for ${meta.articleId} — ${article.image.credit}`);
  }

  writeFileSync(editionFile, `${JSON.stringify(edition, null, 2)}\n`, "utf8");
  rmSync(source);
  rmSync(sidecarPath);
  processed += 1;
}

console.log(processed ? `${processed} upload(s) processed.` : "Nothing processed.");
