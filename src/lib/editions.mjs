/*
# Project:     lovemallacoota.au
# File Name:   editions.mjs
# Description: The weekly edition, read from data/editions/*.json at build time.
#              Git is the datastore: an edition is a file, a published article
#              is a commit, and a correction is visible in the history. See
#              docs/WEEKLY-MOUTH.md.
*/

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { editionCard } from "./social.mjs";
import { plainPunctuation } from "./markup.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = [
  process.cwd(),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
].find((candidate) => existsSync(path.join(candidate, "data", "editions")));

const editionsDir = rootDir ? path.join(rootDir, "data", "editions") : null;

/**
 * Section order, taken from the headings that actually recur across the 37
 * catalogued issues of the Mouth. A section with nothing in it is not rendered.
 */
export const SECTIONS = [
  { id: "editorial", title: "Editorial" },
  { id: "community", title: "Community" },
  { id: "madra", title: "MADRA News" },
  { id: "school", title: "Out and About at MP-12" },
  { id: "local", title: "Local of the Week" },
  { id: "region", title: "Gipsy Point, Genoa and District" },
  { id: "history", title: "Local History" },
  { id: "fishing", title: "Fishing Report" },
  { id: "sports-clubs", title: "Sports Clubs" },
  { id: "social-clubs", title: "Social Clubs" },
  { id: "arts", title: "Arts" },
  { id: "notices", title: "Public Notices" },
  { id: "bdm", title: "Births, Deaths and Marriages" },
  { id: "positions", title: "Positions Vacant" },
  { id: "church", title: "Church Times" },
  { id: "sport", title: "Sport" },
  { id: "kids", title: "Kids' Space" },
  { id: "video", title: "Video of the Week", automatic: true },
  { id: "trail", title: "Trail of the Week", automatic: true },
  { id: "business", title: "Business of the Week", automatic: true },
  { id: "talking", title: "Talking Points", automatic: true },
  { id: "social", title: "Around the Socials", automatic: true },
  { id: "classifieds", title: "Classifieds" },
  { id: "diary", title: "What's On This Week", automatic: true },
  { id: "weather", title: "Weekly Weather Forecast", automatic: true },
  { id: "tides", title: "Tide Times", automatic: true },
  { id: "transport", title: "Buses and Transport", automatic: true },
  { id: "radio", title: "3MGB Wilderness Radio", automatic: true },
];

const SECTION_TITLES = new Map(SECTIONS.map((section) => [section.id, section.title]));

export function sectionTitle(id) {
  return SECTION_TITLES.get(id) || id;
}

/** Keys whose value is an address or an identifier, not prose. */
const LITERAL_KEYS = new Set(["url", "web", "print", "image", "id", "authorEmail", "email", "week", "phone", "sourceUrl", "slug"]);

/**
 * Everything an edition prints goes through plainPunctuation, whatever the
 * file holds: a piece committed straight from the form, or one pasted in by
 * hand, reads the same on the page. See markup.mjs for why.
 */
export function plainEdition(value, key = null) {
  if (typeof value === "string") return key && LITERAL_KEYS.has(key) ? value : plainPunctuation(value);
  if (Array.isArray(value)) return value.map((item) => plainEdition(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plainEdition(v, k)]));
  }
  return value;
}

export function loadEditions({ includeDrafts = false } = {}) {
  if (!editionsDir || !existsSync(editionsDir)) return [];
  return readdirSync(editionsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => plainEdition(JSON.parse(readFileSync(path.join(editionsDir, file), "utf8"))))
    .filter((edition) => includeDrafts || edition.status !== "draft")
    .sort((a, b) => b.week.localeCompare(a.week));
}

/** The edition on the front of the site: the open one, else the most recent. */
export function currentEdition(editions = loadEditions()) {
  return editions.find((edition) => edition.status === "open") || editions[0] || null;
}

export function pastEditions(editions = loadEditions()) {
  const current = currentEdition(editions);
  return editions.filter((edition) => edition !== current);
}

/**
 * Articles grouped into the canonical section order, dropping empty sections so
 * a quiet week reads as a short edition rather than a page of empty headings.
 */
export function sectionsWithContent(edition) {
  return editionSections(edition);
}

/** Table of contents, shared by the web page and the end-of-week PDF. */
function autoEntry(section) {
  const auto = section.auto;
  if (!auto) return null;
  if (auto.type === "weather") return `Seven-day forecast to ${auto.data.days.at(-1).date}`;
  if (auto.type === "tides") return "The week's moon, and where to find the times";
  if (auto.type === "tide-table") return `${auto.data.extremes.length} highs and lows, and the moon`;
  if (auto.type === "diary") return `${auto.data.length} ${auto.data.length === 1 ? "event" : "events"} this week`;
  if (auto.type === "video") return auto.data.title || "This week's video";
  if (auto.type === "trail") return auto.data.name;
  if (auto.type === "business") return auto.data.name;
  if (auto.type === "links") return `${auto.data.length} ${auto.data.length === 1 ? "link" : "links"}`;
  if (auto.type === "timetable") return `${auto.data.services.length} coach services`;
  if (auto.type === "radio") {
    const shows = auto.data.days.reduce((total, day) => total + (day.shows?.length || 0), 0);
    return `${shows} local shows on ${auto.data.frequencies.map((f) => f.mhz).join(" / ")}`;
  }
  return null;
}

export function tableOfContents(edition) {
  return sectionsWithContent(edition).map((section) => {
    const entries = section.articles.map((article) => ({
      id: articleAnchor(article),
      title: article.title,
      byline: article.byline || null,
    }));
    const summary = autoEntry(section);
    // An automatic section still says what is in it, rather than sitting in the
    // contents as an empty bullet.
    if (summary) entries.push({ id: `section-${section.id}`, title: summary, byline: null });
    return { id: section.id, title: section.title, entries };
  });
}

export function articleAnchor(article) {
  return `article-${article.id}`;
}

/** 1 to 52, from the ISO week the edition covers. */
export function weekNumber(edition) {
  return Number(edition.week.split("-w")[1]);
}

/** Edition numbering is YY:WK — the 35th week of 2026 is Edition 26:35. */
export function editionNumber(edition) {
  const [year, week] = edition.week.split("-w");
  return `${year.slice(2)}:${week}`;
}

export function editionLabel(edition) {
  return `Week ${String(weekNumber(edition)).padStart(2, "0")} · Edition ${editionNumber(edition)}`;
}

export function editionTitle(edition) {
  return `Week of ${edition.displayDate}`;
}

export function editionPath(edition) {
  return `/edition/${edition.week}.html`;
}

/** Rendered on demand by the Worker, so every edition has one. */
export function editionPdfPath(edition) {
  return `/edition/${edition.week}.pdf`;
}

export function countArticles(edition) {
  return (edition?.articles || []).length;
}

/**
 * The automatic half of an edition — forecast, events, the trail and the
 * business — generated by tools/refresh-weekly.mjs and committed, so a build
 * never depends on the network and a past edition keeps what it was published
 * with.
 */
/** A small hand-edited data file, absent until there is something to put in it. */
export function loadDataFile(name, fallback) {
  if (!rootDir) return fallback;
  const file = path.join(rootDir, "data", name);
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * The automatic half is normalised too. The calendar feed sends curly
 * apostrophes ("Senior Women’s Exercise Class"), and the first scheduled
 * refresh after the plain-punctuation guard went in failed its own build test
 * on exactly that.
 */
export function loadWeekly(week) {
  if (!rootDir) return null;
  const file = path.join(rootDir, "data", "weekly", `${week}.json`);
  if (!existsSync(file)) return null;
  return plainEdition(JSON.parse(readFileSync(file, "utf8")));
}

/**
 * Tide times are not generated. There is no free, authoritative Australian tide
 * source we may republish, and wrong tide times at a bar crossing are the kind
 * of error that hurts somebody. The section points at the official predictions
 * instead of guessing.
 */
export const TIDE_SOURCE = {
  label: "Tide times for Gabo Island",
  url: "https://tides.willyweather.com.au/vic/east-gippsland/gabo-island.html",
  official: "http://www.bom.gov.au/australia/tides/",
  note: "The Mouth printed tides taken at Gabo Island. We publish the moon, which drives them, and link out for the times themselves rather than republish figures we have not licensed.",
};

/** Every section with something in it, contributed or automatic, in order. */
export function editionSections(edition) {
  if (!edition) return [];
  const articles = edition.articles || [];
  const weekly = loadWeekly(edition.week);

  return SECTIONS.map((section) => {
    const own = articles.filter((article) => article.section === section.id);
    let auto = null;
    if (section.id === "weather" && weekly?.weather?.days?.length) auto = { type: "weather", data: weekly.weather };
    // Real predictions when we have licensed them, the official link otherwise.
    if (section.id === "tides") {
      auto = weekly?.tides?.extremes?.length
        ? { type: "tide-table", data: weekly.tides, moon: weekly?.moon, source: TIDE_SOURCE }
        : { type: "tides", data: TIDE_SOURCE, moon: weekly?.moon };
    }
    if (section.id === "diary" && weekly?.events?.length) auto = { type: "diary", data: weekly.events };
    if (section.id === "video" && edition.video) auto = { type: "video", data: edition.video };
    if (section.id === "trail" && weekly?.trail) auto = { type: "trail", data: weekly.trail };
    if (section.id === "business" && weekly?.business) auto = { type: "business", data: weekly.business };
    if (section.id === "transport") {
      const timetable = loadDataFile("bus-timetable.json", null);
      if (timetable?.services?.length) auto = { type: "timetable", data: timetable };
    }
    // 3MGB's own weekly grid, standing like the timetable rather than
    // regenerated each week. It changes when they publish a new guide.
    if (section.id === "radio") {
      const program = loadDataFile("radio-program.json", null);
      if (program?.days?.some((day) => day.shows?.length)) auto = { type: "radio", data: program };
    }
    if (section.id === "talking") {
      const items = loadDataFile("talking-points.json", []);
      if (items.length) auto = { type: "links", data: items };
    }
    if (section.id === "social") {
      const social = loadDataFile("social-links.json", []);
      const links = Array.isArray(social) ? social : social.links || [];
      if (links.length) {
        auto = {
          type: "links",
          data: links,
          intro: Array.isArray(social) ? null : social.intro,
          invite: Array.isArray(social) ? null : social.invite,
        };
      }
    }
    return { ...section, articles: own, auto };
  }).filter((section) => section.articles.length > 0 || section.auto);
}

/** Every Local of the Week ever published, newest first. */
export function localsOfTheWeek(editions = loadEditions()) {
  return editions
    .flatMap((edition) =>
      (edition.articles || [])
        .filter((article) => article.section === "local")
        .map((article) => ({ ...article, week: edition.week, displayDate: edition.displayDate }))
    )
    .sort((a, b) => b.week.localeCompare(a.week));
}

const ORIGIN = "https://lovemallacoota.au";

/**
 * Share cards that have actually been rendered into images/og. Read once,
 * because an edition page asks for its own card and a missing file would
 * otherwise become a broken Facebook preview.
 */
let renderedCards = null;
function availableCards() {
  if (renderedCards) return renderedCards;
  const dir = rootDir ? path.join(rootDir, "images", "og") : null;
  renderedCards = new Set(dir && existsSync(dir) ? readdirSync(dir) : []);
  return renderedCards;
}

/** The 1200 x 630 card for an edition, frozen per week once it exists. */
export function editionSocialImage(edition) {
  return editionCard(edition.week, availableCards());
}

/** Breadcrumbs, so a deep page shows its place rather than a bare URL. */
export function breadcrumbSchema(trail) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: `${ORIGIN}${step.path}`,
    })),
  };
}

/**
 * An edition as a periodical issue, with each contributed piece as an article.
 * Automatic sections are not articles: nobody wrote the forecast.
 */
export function editionSchema(edition) {
  const pagePath = edition.status === "open" ? "/edition.html" : editionPath(edition);
  const articles = (edition.articles || []).map((article) => ({
    "@type": "NewsArticle",
    headline: article.title,
    datePublished: article.publishedAt || undefined,
    articleSection: sectionTitle(article.section),
    author: article.byline ? { "@type": "Person", name: article.byline } : undefined,
    // A Local of the Week piece is an article *about* somebody. Naming the
    // subject is the difference between a headline and a profile, and it is
    // only claimed where the edition records who the subject is.
    about: article.subject?.name ? { "@type": "Person", name: article.subject.name } : undefined,
    citation: article.sources?.length
      ? article.sources.map((source) => `${source.title}, ${source.publication}, ${source.date}`)
      : undefined,
    image: article.image?.url ? `${ORIGIN}${article.image.url}` : undefined,
    url: `${ORIGIN}${pagePath}#${articleAnchor(article)}`,
    isAccessibleForFree: true,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "PublicationIssue",
    name: `This Week in Mallacoota - ${editionLabel(edition)}`,
    issueNumber: editionNumber(edition),
    datePublished: edition.weekStart,
    url: `${ORIGIN}${pagePath}`,
    isPartOf: {
      "@type": "Periodical",
      name: "This Week in Mallacoota",
      publisher: { "@type": "Organization", name: "Love Mallacoota", url: `${ORIGIN}/` },
    },
    hasPart: articles.length ? articles : undefined,
  };
}

/**
 * The eleven-character YouTube id, from whichever form of the link was pasted.
 * Anything else returns null and the section does not render, rather than
 * embedding a frame pointed at nothing.
 */
export function youTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(String(url));
    if (match) return match[1];
  }
  return null;
}

/**
 * A photograph to fill the space a short edition leaves. Chosen by rotation
 * from data/photo-bank.json so the same picture does not appear two weeks
 * running, and only used when there is a gap worth filling.
 */
export function fillerPhoto(edition) {
  const bank = loadDataFile("photo-bank.json", []);
  if (!bank.length) return null;
  const [, week] = edition.week.split("-w");
  return bank[Number(week) % bank.length];
}

/**
 * Advertisements printed in the edition. These are chosen and frozen per
 * edition rather than served by the ad network: a frozen week is cached for a
 * year, so whatever is in its PDF is there permanently, and that has to be a
 * deliberate booking rather than whatever happened to be live at render time.
 *
 * Sizes are fractions of the page on the six-unit grid:
 *   sixth  two cells   124 × 64mm, or 59 × 134mm upright
 *   third  four cells  124 × 134mm
 *   full   the sheet   190 × 273mm
 *
 * One advertisement per page is the rule, so they are spaced through the
 * edition rather than stacked.
 */
export const AD_SIZES = new Set(["sixth", "third", "full"]);

export function editionAds(edition) {
  return (edition?.ads || []).filter((ad) => AD_SIZES.has(ad.size));
}

/** Where each advertisement sits: after a given section, or on its own page. */
export function adsForSection(edition, sectionId) {
  return editionAds(edition).filter((ad) => ad.after === sectionId && ad.size !== "full");
}

export function fullPageAds(edition) {
  return editionAds(edition).filter((ad) => ad.size === "full");
}

/**
 * The group that belongs beside a given section — the buy-swap-sell group with
 * the classifieds, the weather group with the forecast. A pointer, not a
 * duplicate: most of this town's conversation happens somewhere else, and
 * pretending otherwise helps nobody.
 */
export function socialForSection(sectionId) {
  const social = loadDataFile("social-links.json", []);
  const links = Array.isArray(social) ? social : social.links || [];
  return links.find((link) => link.section === sectionId) || null;
}

/**
 * A three-sixty view, rotated weekly like the trail and the business, so the
 * home page is not the same picture every time somebody visits.
 */
export function panoramaOfTheWeek(week) {
  const data = loadDataFile("panoramas.json", null);
  const views = data?.views || [];
  if (!views.length) return null;
  const index = Number(String(week).split("-w")[1] || 1);
  const view = views[index % views.length];
  return { ...view, position: (index % views.length) + 1, of: views.length };
}

/**
 * The three stops the coach uses around here are named for a landmark in the
 * PTV feed, which is no help to somebody deciding where to stand. These are
 * the towns they are in; anywhere else keeps the feed's own name, because
 * guessing at a town from a stop called "Post Office/Princes Hwy" would be
 * inventing it.
 */
const BUS_PLACE = {
  "Bendigo Bank/Maurice Ave": "Mallacoota",
  "Township/Gipsy Point Rd": "Gipsy Point",
  "Genoa Hotel/Alexanders Rd": "Genoa",
};

export function busPlace(stop) {
  return BUS_PLACE[stop] || stop;
}

/**
 * Split the coach services into the two journeys a reader is actually making:
 * the long-distance coach that passes through Genoa, and the local connection
 * that gets you to Genoa from Mallacoota or Gipsy Point.
 *
 * The old display was one four-column table of stop names, which on a phone
 * was 432px wide inside a 274px card and lost its right-hand columns. Worse,
 * it answered the wrong question: a from/to grid does not tell you that the
 * connection only runs three days a week.
 */
export function busGroups(services = []) {
  const local = (stop) => Boolean(BUS_PLACE[stop]);
  const connection = services.filter((s) => local(s.from) && local(s.to));
  const through = services.filter((s) => !(local(s.from) && local(s.to)));
  // Every day the connection runs, in week order, so the page can say so
  // rather than leaving the reader to work it out from four rows.
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days = new Set();
  for (const s of connection) {
    for (const d of String(s.days || "").split(",")) {
      const day = d.trim();
      if (order.includes(day)) days.add(day);
    }
  }
  return {
    through,
    connection,
    connectionDays: order.filter((d) => days.has(d)),
  };
}

/**
 * Intrinsic pixel size of a picture in the repository, read from the file's
 * own header. No dependency and no decoding: the first few dozen bytes of a
 * WebP, PNG, JPEG or GIF carry the dimensions.
 *
 * The point is the width and height attributes on the <img>. Without them a
 * lazily loaded photograph occupies no space until it arrives and then shoves
 * the story down the page as it lands, which on a phone means the paragraph
 * you were reading jumps away mid-sentence.
 */
const sizeCache = new Map();

function readImageSize(buffer) {
  // PNG: IHDR is the first chunk, width and height big-endian at 16.
  if (buffer.length > 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  // GIF: logical screen descriptor, little-endian at 6.
  if (buffer.length > 10 && buffer.toString("ascii", 0, 3) === "GIF") {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  // WebP: RIFF container, and three different chunk layouts inside it.
  if (buffer.length > 30 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8 ") {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") {
      const at = (offset) => buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
      return { width: at(24) + 1, height: at(27) + 1 };
    }
    return null;
  }
  // JPEG: walk the segments to the frame header that carries the size.
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      // Start of frame, in any of its flavours, but not the restart or
      // huffman-table markers that share the range.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  return null;
}

/** Size of a site-absolute image path, or null when it cannot be read. */
export function imageSize(url) {
  if (!url || typeof url !== "string" || !url.startsWith("/")) return null;
  if (sizeCache.has(url)) return sizeCache.get(url);
  const file = path.join(rootDir, url.replace(/^\//, "").split("?")[0]);
  let size = null;
  if (existsSync(file)) {
    try {
      // The header is all that is needed, so only the first 64KB is read.
      const buffer = readFileSync(file);
      size = readImageSize(buffer.subarray(0, Math.min(buffer.length, 65536)));
    } catch {
      size = null;
    }
  }
  sizeCache.set(url, size);
  return size;
}
