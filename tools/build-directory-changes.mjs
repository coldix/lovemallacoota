/*
# Project:     lovemallacoota.au
# File Name:   build-directory-changes.mjs
# Description: Builds data/directory-changes.json, the running record of what
#              has been added to, removed from and altered in the directory.
#
#              The record is read out of git rather than kept by hand. A
#              hand-kept changelog is a promise to remember, and this repository
#              has already watched one of those go six releases stale. Git holds
#              what actually happened, so the page is derived from it and cannot
#              disagree with the data it describes.
#
#              Every source loadDirectory() reads is replayed at each commit and
#              run through today's assembleEntities, so a listing that arrives
#              from the associations register is caught the same as one typed
#              into a listings file. Two consecutive states are then compared.
#
# Usage:
#   node tools/build-directory-changes.mjs          # rebuild the record
#   node tools/build-directory-changes.mjs --check  # fail if it is out of date
*/

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assembleEntities } from "../src/lib/directory-model.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(rootDir, "data", "directory-changes.json");
const checkOnly = process.argv.includes("--check");

/** Everything loadDirectory() reads. Miss one and a change goes unrecorded. */
const LISTING_FILES = {
  food: "data/listings_food.json",
  stay: "data/listings_accom.json",
  doSee: "data/listings_do.json",
  community: "data/listings_community.json",
  services: "data/listings_services.json",
};
const ENRICHMENT_FILE = "data/directory-enrichment.json";
const ASSOCIATIONS_FILE = "docs/incorporated-associations.json";
const SUBMITTED_DIR = "data/directory";
const PHOTO_DIR = "images/listings";

const WATCHED = [
  ["name", "name"],
  ["section", "section"],
  ["kind", "kind"],
  ["phone", "phone"],
  ["email", "email"],
  ["website", "website"],
  ["descriptionShort", "summary"],
  ["description", "description"],
  ["notes_seasonal", "note"],
  ["trading", "trading status"],
];
/** Shown as before and after. The rest are named but not quoted: a description
 *  reproduced twice in full turns the page into a diff nobody reads. */
const QUOTED = new Set(["name", "kind", "phone", "email", "website", "trading status"]);

function git(args) {
  try {
    // stdio "pipe" for stderr: asking for a file that did not exist yet at an
    // old commit is the normal case here, not something to print.
    return execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function fileAt(sha, file) {
  const raw = git(["show", `${sha}:${file}`]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // A malformed file at some commit in the past is not worth failing over;
    // that commit simply contributes nothing.
    return null;
  }
}

function treeAt(sha, dir) {
  const raw = git(["ls-tree", "-r", "--name-only", sha, dir]);
  return raw ? raw.split("\n").filter(Boolean) : [];
}

/** The same rule the site uses: `<slug>.webp` leads, `<slug>-anything.webp`
 *  follows, and the longest slug wins so one listing cannot take another's. */
function photosBySlug(files, slugs) {
  const ordered = [...slugs].sort((a, b) => b.length - a.length);
  const bySlug = new Map();
  for (const file of files) {
    if (!file.endsWith(".webp")) continue;
    const stem = path.basename(file, ".webp");
    const slug = ordered.find((candidate) => stem === candidate || stem.startsWith(`${candidate}-`));
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, new Set());
    bySlug.get(slug).add(stem);
  }
  return bySlug;
}

function directoryAt(sha) {
  const sources = { enrichment: fileAt(sha, ENRICHMENT_FILE) || {} };
  for (const [key, file] of Object.entries(LISTING_FILES)) {
    const value = fileAt(sha, file);
    sources[key] = Array.isArray(value) ? value : [];
  }
  const seed = fileAt(sha, ASSOCIATIONS_FILE);
  sources.associations = seed?.associations || [];
  sources.submitted = treeAt(sha, SUBMITTED_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => fileAt(sha, file))
    .filter(Boolean);

  const entities = assembleEntities(sources);
  const bySlug = new Map(entities.map((entity) => [entity.slug, entity]));
  const photos = photosBySlug(treeAt(sha, PHOTO_DIR), bySlug.keys());
  return { bySlug, photos };
}

function addressOf(entity) {
  const address = entity.address;
  if (!address) return null;
  return [address.street, address.locality].filter(Boolean).join(", ") || null;
}

function movedMetres(before, after) {
  if (!before?.latitude || !after?.latitude) return null;
  const dy = (before.latitude - after.latitude) * 111320;
  const dx =
    (before.longitude - after.longitude) * 111320 * Math.cos((before.latitude * Math.PI) / 180);
  return Math.round(Math.hypot(dx, dy));
}

function fieldChanges(before, after, photosBefore, photosAfter) {
  const changes = [];

  for (const [key, label] of WATCHED) {
    const from = before[key] ?? null;
    const to = after[key] ?? null;
    // By value, not by reference. `trading` is an object, and comparing two
    // structurally identical ones with !== reported Lee's Pizza as changing its
    // trading status in every commit for a week.
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    if (!QUOTED.has(label)) {
      changes.push({ field: label });
      continue;
    }
    const show = (value) =>
      value && typeof value === "object" ? value.state ?? null : value ?? null;
    changes.push({ field: label, from: show(from), to: show(to) });
  }

  const addressFrom = addressOf(before);
  const addressTo = addressOf(after);
  if (addressFrom !== addressTo) changes.push({ field: "address", from: addressFrom, to: addressTo });

  const moved = movedMetres(before.geo, after.geo);
  if (moved && moved >= 10) changes.push({ field: "map pin", moved });
  else if (!before.geo?.latitude && after.geo?.latitude) changes.push({ field: "map pin", added: true });

  const gained = [...(photosAfter || [])].filter((stem) => !(photosBefore || new Set()).has(stem));
  const lost = [...(photosBefore || [])].filter((stem) => !(photosAfter || new Set()).has(stem));
  if (gained.length) changes.push({ field: "photographs", added: gained.length });
  if (lost.length) changes.push({ field: "photographs", removed: lost.length });

  const hoursFrom = JSON.stringify(before.openingHours || []);
  const hoursTo = JSON.stringify(after.openingHours || []);
  if (hoursFrom !== hoursTo) changes.push({ field: "opening hours" });

  const menuFrom = JSON.stringify(before.menu || null);
  const menuTo = JSON.stringify(after.menu || null);
  if (menuFrom !== menuTo) {
    changes.push({ field: "menu", added: !before.menu && Boolean(after.menu) });
  }

  return changes;
}

/**
 * Renames, so the page does not report a listing as removed and a stranger as
 * added when the two are the same place under a new slug.
 *
 * Identity survives a rename in one of three ways, tried hardest first: the
 * incorporated-association number, git's own detection of the listing's
 * photograph being moved in that commit, or the name. A slug that merely grew
 * a suffix is the last resort.
 */
function renamesIn(sha, removed, added) {
  const pairs = [];
  const takenFrom = new Set();
  const takenTo = new Set();

  const photoMoves = new Map();
  const raw = git(["show", "--name-status", "-M", "--format=", sha, "--", PHOTO_DIR]) || "";
  for (const line of raw.split("\n")) {
    const [status, from, to] = line.split("\t");
    if (!status?.startsWith("R") || !from || !to) continue;
    photoMoves.set(path.basename(from, ".webp"), path.basename(to, ".webp"));
  }

  const keys = [
    (entity) => entity.registration?.number || null,
    (entity) => photoMoves.get(entity.slug) || null,
    (entity) => (entity.name ? `name:${entity.name}` : null),
  ];

  for (const key of keys) {
    for (const before of removed) {
      if (takenFrom.has(before.slug)) continue;
      const beforeKey = key === keys[1] ? photoMoves.get(before.slug) : key(before);
      if (!beforeKey) continue;
      const match = added.find((after) => {
        if (takenTo.has(after.slug)) return false;
        return key === keys[1] ? after.slug === beforeKey : key(after) === beforeKey;
      });
      if (!match) continue;
      takenFrom.add(before.slug);
      takenTo.add(match.slug);
      pairs.push([before, match]);
    }
  }

  // A slug that only gained or shed a suffix, e.g. …-tool-library becoming
  // …-tool-library-madtl.
  for (const before of removed) {
    if (takenFrom.has(before.slug)) continue;
    const match = added.find(
      (after) =>
        !takenTo.has(after.slug) &&
        (after.slug.startsWith(`${before.slug}-`) || before.slug.startsWith(`${after.slug}-`))
    );
    if (!match) continue;
    takenFrom.add(before.slug);
    takenTo.add(match.slug);
    pairs.push([before, match]);
  }

  return { pairs, takenFrom, takenTo };
}

const log = git([
  "log",
  // The mainline only. Walking into merged branches replays states that were
  // never live, and a listing submitted on one side reads as removed and then
  // added again when the merge lands.
  "--first-parent",
  "--reverse",
  "--format=%H%x1f%aI%x1f%s",
  "--",
  ...Object.values(LISTING_FILES),
  ENRICHMENT_FILE,
  ASSOCIATIONS_FILE,
  SUBMITTED_DIR,
  PHOTO_DIR,
]);

if (!log) {
  console.error("No git history for the directory data. Nothing written.");
  process.exit(1);
}

const commits = log
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [sha, date, subject] = line.split("\x1f");
    return { sha, date, subject };
  });

// The first state is the baseline. Emitting it would say 90-odd listings were
// added on the day the repository started, which is true of the file and
// useless to a reader.
let previous = directoryAt(commits[0].sha);
const baseline = { date: commits[0].date, listings: previous.bySlug.size };
const entries = [];

for (const commit of commits.slice(1)) {
  const current = directoryAt(commit.sha);
  const gone = [...previous.bySlug.values()].filter((entity) => !current.bySlug.has(entity.slug));
  const fresh = [...current.bySlug.values()].filter((entity) => !previous.bySlug.has(entity.slug));
  const { pairs, takenFrom, takenTo } = renamesIn(commit.sha, gone, fresh);

  const added = fresh
    .filter((entity) => !takenTo.has(entity.slug))
    .map((entity) => ({
      slug: entity.slug,
      name: entity.name,
      section: entity.section,
      kind: entity.kind || null,
    }));
  const removed = gone
    .filter((entity) => !takenFrom.has(entity.slug))
    .map((entity) => ({ slug: entity.slug, name: entity.name, section: entity.section }));
  const renamed = pairs.map(([before, after]) => ({
    from: before.slug,
    to: after.slug,
    fromName: before.name,
    name: after.name,
    section: after.section,
    // The name is already the whole point of the line, and the photographs move
    // with the slug, so counting them as added and removed is the rename
    // describing its own mechanics back at the reader.
    fields: fieldChanges(
      before,
      after,
      previous.photos.get(before.slug),
      current.photos.get(after.slug)
    ).filter((field) => field.field !== "name" && field.field !== "photographs"),
  }));

  const changed = [];
  for (const [slug, entity] of current.bySlug) {
    const before = previous.bySlug.get(slug);
    if (!before) continue;
    const fields = fieldChanges(before, entity, previous.photos.get(slug), current.photos.get(slug));
    if (fields.length) changed.push({ slug, name: entity.name, section: entity.section, fields });
  }

  if (added.length || removed.length || renamed.length || changed.length) {
    entries.push({
      commit: commit.sha.slice(0, 7),
      date: commit.date,
      subject: commit.subject,
      added,
      removed,
      renamed,
      changed,
    });
  }
  previous = current;
}

entries.reverse();

const record = {
  generator: "tools/build-directory-changes.mjs",
  baseline,
  listings: previous.bySlug.size,
  entries,
};

const serialised = `${JSON.stringify(record, null, 2)}\n`;

if (checkOnly) {
  let existing = null;
  try {
    existing = readFileSync(outFile, "utf8");
  } catch {
    existing = null;
  }
  if (existing !== serialised) {
    console.error("data/directory-changes.json is out of date. Run: pnpm run changes");
    process.exit(1);
  }
  console.log("data/directory-changes.json is current.");
} else {
  writeFileSync(outFile, serialised);
  const totals = entries.reduce(
    (sum, entry) => ({
      added: sum.added + entry.added.length,
      removed: sum.removed + entry.removed.length,
      changed: sum.changed + entry.changed.length,
    }),
    { added: 0, removed: 0, changed: 0 }
  );
  console.log(
    `Wrote data/directory-changes.json — ${entries.length} dated entries, ` +
      `${totals.added} added, ${totals.removed} removed, ${totals.changed} changed, ` +
      `from a baseline of ${baseline.listings} on ${baseline.date.slice(0, 10)}.`
  );
}
