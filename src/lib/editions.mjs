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
  { id: "weather", title: "Weekly Weather Forecast", automatic: true },
  { id: "tides", title: "Tide Times", automatic: true },
  { id: "diary", title: "Mouth Diary", automatic: true },
  { id: "madra", title: "MADRA News" },
  { id: "school", title: "Out and About at MP-12" },
  { id: "community", title: "Community" },
  { id: "notices", title: "Public Notices" },
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
  if (!edition) return [];
  const articles = edition.articles || [];
  return SECTIONS.map((section) => ({
    ...section,
    articles: articles.filter((article) => article.section === section.id),
  })).filter((section) => section.articles.length > 0);
}

/** Table of contents, shared by the web page and the end-of-week PDF. */
export function tableOfContents(edition) {
  return sectionsWithContent(edition).map((section) => ({
    id: section.id,
    title: section.title,
    entries: section.articles.map((article) => ({
      id: articleAnchor(article),
      title: article.title,
      byline: article.byline || null,
    })),
  }));
}

export function articleAnchor(article) {
  return `article-${article.id}`;
}

export function editionTitle(edition) {
  return `Week of ${edition.displayDate}`;
}

export function editionPath(edition) {
  return `/edition/${edition.week}.html`;
}

export function countArticles(edition) {
  return (edition?.articles || []).length;
}
