/*
# Project:     lovemallacoota.au
# File Name:   directory.mjs
# Description: Build-time directory loader. Reads listing JSON, the CAV seed,
#              enrichment, and any per-listing files under data/directory/.
*/

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SHOP_SLUGS,
  SITE_ORIGIN,
  assembleEntities,
  collectionSchema,
  displayTags,
  entityBySlug as findBySlug,
  entitySchema,
  entitiesForSection,
  formatAddress,
  getPrimaryLink,
  getPrimaryLinkLabel,
  mapLinks,
  searchText,
  tagFilters,
  telHref,
  verificationLine,
} from "./directory-model.mjs";

export {
  ENTITY_TYPES,
  FORM_ENTITY_TYPES,
  SECTIONS,
  SHOP_SLUGS,
  SITE_ORIGIN,
  WHATS_ON,
  canClaim,
  collectionSchema,
  displayTags,
  entitySchema,
  entitiesForSection,
  formatAddress,
  formatVerificationDate,
  getPrimaryLink,
  getPrimaryLinkLabel,
  isOfficialEntity,
  isStale,
  listingDescription,
  listingKind,
  listingTitle,
  mapLinks,
  relatedEntities,
  schemaTypeFor,
  searchText,
  slugify,
  tagFilters,
  telHref,
  verificationLine,
  verificationState,
} from "./directory-model.mjs";

const rootDir = [
  process.cwd(),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
].find((candidate) => existsSync(path.join(candidate, "data", "listings_food.json")));

if (!rootDir) {
  throw new Error("Cannot locate the data directory — run builds and tests from the project root");
}

function readJson(relative, fallback) {
  const file = path.join(rootDir, relative);
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8"));
}

function readListingArray(file) {
  const parsed = readJson(path.join("data", file), []);
  if (!Array.isArray(parsed)) {
    throw new Error(`data/${file} must be an array of listings`);
  }
  return parsed;
}

function submittedListings() {
  const dir = path.join(rootDir, "data", "directory");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => readJson(path.join("data", "directory", file), null))
    .filter(Boolean);
}

let cached = null;

export function loadDirectory() {
  if (cached) return cached;
  const seed = readJson("docs/incorporated-associations.json", { associations: [] });
  cached = assembleEntities({
    food: readListingArray("listings_food.json"),
    stay: readListingArray("listings_accom.json"),
    doSee: readListingArray("listings_do.json"),
    community: readListingArray("listings_community.json"),
    services: readListingArray("listings_services.json"),
    submitted: submittedListings(),
    associations: seed.associations || [],
    enrichment: readJson("data/directory-enrichment.json", {}),
  });
  return cached;
}

export function entityBySlug(slug) {
  return findBySlug(loadDirectory(), slug);
}

export function sectionEntities(sectionId) {
  return entitiesForSection(loadDirectory(), sectionId);
}

export function sectionCounts() {
  const counts = { "eat-drink": 0, stay: 0, "do-see": 0, community: 0, services: 0 };
  for (const entity of loadDirectory()) {
    if (counts[entity.section] !== undefined) counts[entity.section] += 1;
  }
  return counts;
}

/**
 * Hero image for a listing, but only when the file is actually in the
 * repository. A dedicated listings photo wins over the older business image.
 */
export function listingPhoto(entity) {
  const dedicated = `/images/listings/${entity.slug}.webp`;
  if (existsSync(path.join(rootDir, dedicated.replace(/^\//, "")))) {
    return { url: dedicated, alt: entity.name };
  }
  const images = entity.images || [];
  const hero = images.find((image) => image.is_hero) || images[0];
  if (!hero?.url) return null;
  const relative = hero.url.replace(/^\//, "");
  if (!existsSync(path.join(rootDir, relative))) return null;
  return { url: hero.url, alt: hero.alt_text || entity.name || "" };
}

export function listingPagePath(entity) {
  return `/listing/${entity.slug}.html`;
}

export function photoAbsoluteUrl(entity) {
  const photo = listingPhoto(entity);
  return photo ? `${SITE_ORIGIN}${photo.url}` : undefined;
}

export function letterIndex(entities) {
  const letters = [];
  for (const entity of entities) {
    const letter = (entity.name.match(/[A-Za-z]/) || ["#"])[0].toUpperCase();
    if (!letters.includes(letter)) letters.push(letter);
  }
  return letters.sort();
}
