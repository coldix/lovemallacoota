/*
# Project:     lovemallacoota.au
# File Name:   editions.mjs
# Description: The weekly edition, read from data/editions/*.json at build time.
#              Git is the datastore: an edition is a file, a published article
#              is a commit, and a correction is visible in the history. See
#              docs/WEEKLY-MOUTH.md.
*/

import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  { id: "local", title: "Local of the Week" },
  { id: "weather", title: "Weekly Weather Forecast", automatic: true },
  { id: "tides", title: "Tide Times", automatic: true },
  { id: "diary", title: "This Week's Diary", automatic: true },
  { id: "video", title: "Video of the Week", automatic: true },
  { id: "trail", title: "Trail of the Week", automatic: true },
  { id: "business", title: "Business of the Week", automatic: true },
  { id: "transport", title: "Buses and Transport", automatic: true },
  { id: "talking", title: "Talking Points", automatic: true },
  { id: "social", title: "Around the Socials", automatic: true },
  { id: "madra", title: "MADRA News" },
  { id: "school", title: "Out and About at MP-12" },
  { id: "community", title: "Community" },
  { id: "region", title: "Gipsy Point, Genoa and District" },
  { id: "history", title: "History" },
  { id: "fishing", title: "Fishing Report" },
  { id: "sports-clubs", title: "Sports Clubs" },
  { id: "social-clubs", title: "Social Clubs" },
  { id: "arts", title: "Arts" },
  { id: "notices", title: "Public Notices" },
  { id: "bdm", title: "Births, Deaths and Marriages" },
  { id: "classifieds", title: "Classifieds" },
  { id: "positions", title: "Positions Vacant" },
  { id: "church", title: "Church Times" },
  { id: "sport", title: "Sport" },
  { id: "kids", title: "Kids' Space" },
];

const SECTION_TITLES = new Map(SECTIONS.map((section) => [section.id, section.title]));

export function sectionTitle(id) {
  return SECTION_TITLES.get(id) || id;
}

export function loadEditions() {
  if (!editionsDir || !existsSync(editionsDir)) return [];
  return readdirSync(editionsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(path.join(editionsDir, file), "utf8")))
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
  if (auto.type === "tides") return "Official predictions, Gabo Island";
  if (auto.type === "tide-table") return `Highs and lows, ${auto.data.station}`;
  if (auto.type === "diary") return `${auto.data.length} ${auto.data.length === 1 ? "event" : "events"} this week`;
  if (auto.type === "video") return auto.data.title || "This week's video";
  if (auto.type === "trail") return auto.data.name;
  if (auto.type === "business") return auto.data.name;
  if (auto.type === "links") return `${auto.data.length} ${auto.data.length === 1 ? "link" : "links"}`;
  if (auto.type === "timetable") return `${auto.data.services.length} coach services`;
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

export function loadWeekly(week) {
  if (!rootDir) return null;
  const file = path.join(rootDir, "data", "weekly", `${week}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * Tide times are not generated. There is no free, authoritative Australian tide
 * source we may republish, and wrong tide times at a bar crossing are the kind
 * of error that hurts somebody. The section points at the official predictions
 * instead of guessing.
 */
export const TIDE_SOURCE = {
  label: "Bureau of Meteorology tide predictions — Gabo Island",
  url: "http://www.bom.gov.au/australia/tides/",
  note: "The Mouth printed tides taken at Gabo Island. We link to the official predictions rather than republish figures we cannot verify.",
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
      auto = weekly?.tides
        ? { type: "tide-table", data: weekly.tides }
        : { type: "tides", data: TIDE_SOURCE };
    }
    if (section.id === "diary" && weekly?.events?.length) auto = { type: "diary", data: weekly.events };
    if (section.id === "video" && edition.video) auto = { type: "video", data: edition.video };
    if (section.id === "trail" && weekly?.trail) auto = { type: "trail", data: weekly.trail };
    if (section.id === "business" && weekly?.business) auto = { type: "business", data: weekly.business };
    if (section.id === "transport") {
      const timetable = loadDataFile("bus-timetable.json", null);
      if (timetable?.services?.length) auto = { type: "timetable", data: timetable };
    }
    if (section.id === "talking") {
      const items = loadDataFile("talking-points.json", []);
      if (items.length) auto = { type: "links", data: items };
    }
    if (section.id === "social") {
      const social = loadDataFile("social-links.json", []);
      const links = Array.isArray(social) ? social : social.links || [];
      if (links.length) {
        auto = { type: "links", data: links, intro: Array.isArray(social) ? null : social.intro };
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
    image: article.image?.url ? `${ORIGIN}${article.image.url}` : undefined,
    url: `${ORIGIN}${pagePath}#${articleAnchor(article)}`,
    isAccessibleForFree: true,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "PublicationIssue",
    name: `This Week in Mallacoota — ${editionLabel(edition)}`,
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

/** A Local of the Week profile is an article about a person. */
export function localSchema(local) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: local.title,
    datePublished: local.publishedAt || undefined,
    articleSection: "Local of the Week",
    author: local.byline ? { "@type": "Person", name: local.byline } : undefined,
    about: local.subject?.name ? { "@type": "Person", name: local.subject.name } : undefined,
    image: local.image?.url ? `${ORIGIN}${local.image.url}` : undefined,
    url: `${ORIGIN}/locals.html#${articleAnchor(local)}`,
    isAccessibleForFree: true,
    citation: (local.sources || []).map(
      (source) => `${source.title}, ${source.publication}, ${source.date}`
    ),
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
