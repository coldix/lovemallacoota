/*
# Project:     lovemallacoota.au
# File Name:   roll-edition.mjs
# Description: Closes the week and opens the next one. Any open edition whose
#              last day has arrived is frozen, and the following week is created
#              open and empty. Idempotent: running it twice, or a day late,
#              changes nothing the first run already did.
#
# Usage:
#   node tools/roll-edition.mjs             # act on today (Melbourne)
#   node tools/roll-edition.mjs --today=2026-08-30
#   node tools/roll-edition.mjs --dry-run
*/

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const editionsDir = path.join(rootDir, "data", "editions");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const todayArg = [...args].find((arg) => arg.startsWith("--today="))?.slice("--today=".length);

/** Today in Melbourne, which is the only clock this publication runs on. */
export function melbourneToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isoWeekOf(isoDate) {
  const target = new Date(`${isoDate}T00:00:00Z`);
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-w${String(week).padStart(2, "0")}`;
}

export function mondayOfWeek(week) {
  const [year, rest] = week.split("-w");
  const jan4 = new Date(Date.UTC(Number(year), 0, 4));
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1));
  const monday = new Date(firstMonday);
  monday.setUTCDate(firstMonday.getUTCDate() + (Number(rest) - 1) * 7);
  return monday;
}

const DISPLAY = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function newEdition(week) {
  const monday = mondayOfWeek(week);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return {
    week,
    displayDate: DISPLAY.format(monday),
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
    status: "open",
    editor: "Colin Dixon",
    articles: [],
  };
}

function loadEditions() {
  if (!existsSync(editionsDir)) return [];
  return readdirSync(editionsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => ({
      file: path.join(editionsDir, file),
      edition: JSON.parse(readFileSync(path.join(editionsDir, file), "utf8")),
    }));
}

/**
 * What should change today. Returned rather than performed, so the decision can
 * be tested without touching the repository.
 */
export function plan(editions, today) {
  const freezes = editions
    .filter(({ edition }) => edition.status === "open" && edition.weekEnd <= today)
    .map(({ edition }) => edition.week);

  const weeks = new Set(editions.map(({ edition }) => edition.week));
  const currentWeek = isoWeekOf(today);

  // The week to open is whichever week today belongs to, unless today is the
  // last day of a week we are closing — then it is the week after.
  const closingToday = editions.some(
    ({ edition }) => edition.weekEnd === today && edition.week === currentWeek
  );
  const openWeek = closingToday
    ? isoWeekOf(new Date(new Date(`${today}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10))
    : currentWeek;

  return { freezes, create: weeks.has(openWeek) ? null : openWeek };
}

const today = todayArg || melbourneToday();
const editions = loadEditions();
const { freezes, create } = plan(editions, today);

console.log(`today ${today} (${isoWeekOf(today)})`);

for (const { file, edition } of editions) {
  if (!freezes.includes(edition.week)) continue;
  console.log(`  freeze ${edition.week} (${(edition.articles || []).length} items)`);
  if (dryRun) continue;
  edition.status = "frozen";
  edition.frozenAt = new Date().toISOString();
  writeFileSync(file, `${JSON.stringify(edition, null, 2)}\n`);
}

if (create) {
  console.log(`  open   ${create}`);
  if (!dryRun) {
    mkdirSync(editionsDir, { recursive: true });
    writeFileSync(
      path.join(editionsDir, `${create}.json`),
      `${JSON.stringify(newEdition(create), null, 2)}\n`
    );
  }
} else {
  console.log("  open   nothing to create");
}

if (!freezes.length && !create) console.log("  nothing to do");
if (dryRun) console.log("\n(dry run — nothing written)");
