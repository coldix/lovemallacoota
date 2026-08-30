/*
# Project:     lovemallacoota.au
# File Name:   build-og.mjs
# Description: Open Graph cards, 1200 x 630, generated from Colin's own
#              photographs and committed to the repository.
#
# Why generate them here rather than at build time or at the edge:
#   - a share card must never change after it is shared, and a frozen edition's
#     card is a file in git rather than something a later build recomputes;
#   - Facebook scrapes the URL once and caches it, so the bytes have to exist
#     before the link is posted, not be rendered on demand;
#   - the build stays static and offline.
#
# Run it after adding a photograph, a cover or an edition:
#   pnpm run og            regenerate anything missing
#   pnpm run og -- --force rebuild every card
#
# Every card is a real Mallacoota photograph with a dark band across the foot
# carrying the label. Nothing here invents a scene: the pictures are Colin's,
# the sober cards (emergency, archive) carry no photograph at all rather than
# dress up a subject that should not be dressed up.
*/

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "images", "og");

export const WIDTH = 1200;
export const HEIGHT = 630;

const force = process.argv.includes("--force");

/** Type large enough to survive a Facebook thumbnail, so nothing needs zooming. */
const FONT = "Poppins, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const INK = "#ffffff";
const EYEBROW_INK = "#f4c98a";
const NIGHT = "#04101c";

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Rough width per character at a given size, used only to decide where a title
 * wraps. There is no text metric available here, and being a little cautious
 * costs nothing: an over-eager wrap still reads, an overflow does not.
 */
function wrap(text, size, maxWidth) {
  const perChar = size * 0.54;
  const limit = Math.max(8, Math.floor(maxWidth / perChar));
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > limit && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The overlay: a scrim heavy enough to hold white type over a bright sky, and
 * the label sitting on it. Two lines of title at most — a third means the label
 * is doing a description's job.
 */
function overlaySvg({ eyebrow, title, subtitle, sober = false }) {
  const margin = 72;
  const maxText = WIDTH - margin * 2;
  const titleSize = String(title).length > 22 ? 74 : 92;
  const lines = wrap(title, titleSize, maxText).slice(0, 2);
  const lineHeight = Math.round(titleSize * 1.08);

  // Lay the block out from the bottom up so the baseline never drifts with the
  // number of lines.
  const footY = HEIGHT - margin;
  const subtitleY = subtitle ? footY : null;
  const titleBottom = subtitle ? footY - 52 : footY;
  const titleTop = titleBottom - lineHeight * (lines.length - 1);
  const eyebrowY = titleTop - titleSize * 0.82;

  const scrimTop = sober ? 0 : Math.max(0, eyebrowY - 150);
  const scrim = sober
    ? ""
    : `<rect x="0" y="${scrimTop}" width="${WIDTH}" height="${HEIGHT - scrimTop}" fill="url(#scrim)"/>`;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04101c" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#04101c" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#04101c" stop-opacity="0.94"/>
    </linearGradient>
  </defs>
  ${scrim}
  <text x="${margin}" y="${eyebrowY}" font-family="${FONT}" font-size="27" font-weight="600" letter-spacing="6" fill="${EYEBROW_INK}">${escapeXml(eyebrow.toUpperCase())}</text>
  ${lines
    .map(
      (line, index) =>
        `<text x="${margin}" y="${titleTop + index * lineHeight}" font-family="${FONT}" font-size="${titleSize}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  ${subtitle ? `<text x="${margin}" y="${subtitleY}" font-family="${FONT}" font-size="32" font-weight="500" fill="#dbe7f2">${escapeXml(subtitle)}</text>` : ""}
</svg>`);
}

/**
 * The photograph, cropped to the card rather than squashed into it. There are
 * eight photographs in the bank and more cards than that, so a card that has to
 * reuse one takes a different crop of it: two cards sharing a picture should
 * not look like the same card at thumbnail size.
 */
async function photoBase(source, crop) {
  return sharp(source)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: crop || sharp.strategy.attention })
    .modulate({ brightness: 0.94 })
    .toBuffer();
}

/** No photograph: a plain night card for subjects a picture would misrepresent. */
function soberBase(tint = NIGHT) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${tint}"/>
      <stop offset="1" stop-color="#0b2436"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect x="0" y="${HEIGHT - 10}" width="${WIDTH}" height="10" fill="#24c8e8"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** The wordmark, small, top left, so a card is recognisable at thumbnail size. */
let logoBuffer = null;
async function logo() {
  if (logoBuffer) return logoBuffer;
  logoBuffer = await sharp(path.join(rootDir, "images", "logo.png"))
    .resize({ width: 232 })
    .toBuffer();
  return logoBuffer;
}

export async function renderCard({ out, photo, crop, eyebrow, title, subtitle, sober = false, tint }) {
  const target = path.join(outDir, out);
  if (!force && existsSync(target)) return { out, skipped: true };

  const base = sober || !photo ? await soberBase(tint) : await photoBase(photo, crop);
  const composed = await sharp(base)
    .composite([
      { input: overlaySvg({ eyebrow, title, subtitle, sober: sober || !photo }), top: 0, left: 0 },
      { input: await logo(), top: 56, left: 68 },
    ])
    // Facebook re-encodes anyway; 82 keeps the file well under the 300 KB that
    // makes a scrape slow without visible loss at card size.
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  await sharp(composed).toFile(target);
  return { out, skipped: false };
}

const bankPath = (slug) => path.join(rootDir, "images", "bank", `${slug}.webp`);

/**
 * One card per fixed destination. The photographs are chosen for what the page
 * is about, and reused deliberately rather than randomly: a card should look
 * the same every time that page is shared.
 */
export const FIXED_CARDS = [
  {
    out: "home.jpg",
    photo: bankPath("the-mouth"),
    eyebrow: "East Gippsland, Victoria",
    title: "Mallacoota",
    subtitle: "The town directory, the weekly edition and what's on",
  },
  {
    out: "edition.jpg",
    photo: bankPath("mallacoota-town"),
    eyebrow: "Weekly edition",
    title: "This Week in Mallacoota",
    subtitle: "Notices, club and school news, weather and tides",
  },
  {
    out: "calendar.jpg",
    photo: bankPath("bastion-point"),
    eyebrow: "What's on",
    title: "Events in Mallacoota",
    subtitle: "Markets, meetups, workshops and club nights",
  },
  {
    out: "directory.jpg",
    photo: bankPath("mallacoota-town"),
    crop: "left",
    eyebrow: "Directory",
    title: "Every business, club and service",
    subtitle: "Mallacoota and district, in one place",
  },
  {
    out: "food.jpg",
    photo: bankPath("betka-beach"),
    eyebrow: "Directory",
    title: "Eat & Drink in Mallacoota",
    subtitle: "Cafes, seafood, bakeries, pubs and takeaway",
  },
  {
    out: "accom.jpg",
    photo: bankPath("karbeethong-view"),
    eyebrow: "Directory",
    title: "Stay in Mallacoota",
    subtitle: "Lodges, motels, holiday houses and caravan parks",
  },
  {
    out: "activity.jpg",
    photo: bankPath("bastion-path"),
    eyebrow: "Directory",
    title: "Things to do in Mallacoota",
    subtitle: "Boat hire, walks, beaches, tours and attractions",
  },
  {
    out: "community.jpg",
    photo: bankPath("karbeethong-lodge"),
    eyebrow: "Directory",
    title: "Mallacoota community groups",
    subtitle: "Clubs, sport, arts, churches and volunteers",
  },
  {
    out: "services.jpg",
    photo: bankPath("mallacoota-airport"),
    eyebrow: "Directory",
    title: "Services in Mallacoota",
    subtitle: "Trades, health, shops and public services",
  },
  {
    // Local history, not tourism: a plain card rather than a beach.
    out: "archive.jpg",
    sober: true,
    tint: "#241a10",
    eyebrow: "Local history",
    title: "The Mallacoota Mouth archive",
    subtitle: "Every issue catalogued, 1979 onwards",
  },
  {
    // Sober and functional. No fire, no flood, nothing dramatic.
    out: "emergency.jpg",
    sober: true,
    eyebrow: "Official sources",
    title: "Mallacoota emergency information",
    subtitle: "In an emergency call 000",
  },
  {
    out: "add-listing.jpg",
    photo: bankPath("karbeethong-lodge"),
    crop: "right",
    eyebrow: "Free listing",
    title: "Add your listing",
    subtitle: "Businesses, clubs and services, verified by email",
  },
];

/**
 * A card per edition, frozen the first time it is generated. The cover
 * photographs are upright for print, so the card is a crop of the cover rather
 * than the cover letterboxed into a landscape frame.
 */
async function editionCards() {
  const editionsDir = path.join(rootDir, "data", "editions");
  if (!existsSync(editionsDir)) return [];
  const files = (await readdir(editionsDir)).filter((file) => file.endsWith(".json"));
  const cards = [];
  for (const file of files) {
    const edition = JSON.parse(readFileSync(path.join(editionsDir, file), "utf8"));
    if (edition.status === "draft") continue;
    const cover = edition.cover?.web && path.join(rootDir, edition.cover.web.replace(/^\//, ""));
    const [year, week] = edition.week.split("-w");
    cards.push({
      out: `edition-${edition.week}.jpg`,
      photo: cover && existsSync(cover) ? cover : bankPath("mallacoota-town"),
      eyebrow: `Week ${week} · Edition ${year.slice(2)}:${week}`,
      title: "This Week in Mallacoota",
      subtitle: `Week of ${edition.displayDate}`,
    });
  }
  return cards;
}

export async function buildAll() {
  await mkdir(outDir, { recursive: true });
  const cards = [...FIXED_CARDS, ...(await editionCards())];
  const results = [];
  for (const card of cards) {
    results.push(await renderCard(card));
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = await buildAll();
  const made = results.filter((result) => !result.skipped);
  console.log(
    made.length
      ? `Rendered ${made.length} Open Graph card(s): ${made.map((r) => r.out).join(", ")}`
      : `Nothing to do — ${results.length} card(s) already rendered. Use --force to rebuild.`
  );
}
