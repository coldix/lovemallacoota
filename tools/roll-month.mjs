/*
# Project:     lovemallacoota.au
# File Name:   roll-month.mjs
# Description: Closes the calendar-month Coota and opens the next one. Any open
#              monthly whose last day has passed is frozen, and this calendar
#              month is created open and empty. Last issue's crossword solution
#              is copied onto the new month; the new puzzle is added by hand.
#              Idempotent. Dispatch-only until it has been run by hand once.
#
# Usage:
#   node tools/roll-month.mjs             # act on today (Melbourne)
#   node tools/roll-month.mjs --today=2026-10-01
#   node tools/roll-month.mjs --dry-run
*/

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { melbourneToday } from "./roll-edition.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const editionsDir = path.join(rootDir, "data", "editions");
const crosswordHold = path.join(rootDir, "data", "crossword");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const todayArg = [...args].find((arg) => arg.startsWith("--today="))?.slice("--today=".length);

function isMonthlyEdition(edition) {
  return edition?.kind === "monthly" || /^\d{4}-\d{2}$/.test(edition?.week || "");
}

export function nextMonth(month) {
  const [year, rest] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, rest, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthBounds(month) {
  const [year, rest] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, rest, 0));
  return { start: `${month}-01`, end: last.toISOString().slice(0, 10) };
}

const DISPLAY = new Intl.DateTimeFormat("en-AU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function monthDisplay(month) {
  const [year, rest] = month.split("-").map(Number);
  return DISPLAY.format(new Date(Date.UTC(year, rest - 1, 1)));
}

export function newMonthly(month, { previousCrossword } = {}) {
  const { start, end } = monthBounds(month);
  const edition = {
    week: month,
    kind: "monthly",
    displayDate: monthDisplay(month),
    monthStart: start,
    monthEnd: end,
    status: "open",
    editor: "Colin Dixon",
    articles: [],
  };
  if (previousCrossword?.number) {
    edition.crossword = {
      solutionOfPrevious: {
        number: previousCrossword.number,
        title: previousCrossword.title || null,
        pages: [`/images/editions/crossword-${previousCrossword.number}-soln-1.webp`],
        pdf: `/pdf/crossword-${previousCrossword.number}-solution.pdf`,
      },
    };
  }
  return edition;
}

/**
 * What should change today. Returned rather than performed, so the decision can
 * be tested without touching the repository.
 *
 * Freeze the day *after* monthEnd, so the last day of the month still accepts
 * stories. Open whichever calendar month today belongs to, if it is missing.
 */
export function planMonth(editions, today) {
  const currentMonth = today.slice(0, 7);
  const freezes = editions
    .filter(
      ({ edition }) =>
        edition.status === "open" &&
        isMonthlyEdition(edition) &&
        edition.monthEnd &&
        edition.monthEnd < today
    )
    .map(({ edition }) => edition.week);

  const months = new Set(editions.map(({ edition }) => edition.week));
  return { freezes, create: months.has(currentMonth) ? null : currentMonth };
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

/** Copy a held crossword solution into the public folders for the next issue. */
export function publishHeldSolution(number, { dry = false } = {}) {
  const copied = [];
  const webpFrom = path.join(crosswordHold, `crossword-${number}-soln-1.webp`);
  const pdfFrom = path.join(crosswordHold, `crossword-${number}-solution.pdf`);
  const webpTo = path.join(rootDir, "images", "editions", `crossword-${number}-soln-1.webp`);
  const pdfTo = path.join(rootDir, "pdf", `crossword-${number}-solution.pdf`);
  if (existsSync(webpFrom)) {
    if (!dry) {
      mkdirSync(path.dirname(webpTo), { recursive: true });
      copyFileSync(webpFrom, webpTo);
    }
    copied.push(path.relative(rootDir, webpTo));
  }
  if (existsSync(pdfFrom)) {
    if (!dry) {
      mkdirSync(path.dirname(pdfTo), { recursive: true });
      copyFileSync(pdfFrom, pdfTo);
    }
    copied.push(path.relative(rootDir, pdfTo));
  }
  return copied;
}

function isInvokedDirectly() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return path.resolve(invoked) === fileURLToPath(import.meta.url);
}

if (isInvokedDirectly()) {
  const today = todayArg || melbourneToday();
  const editions = loadEditions();
  const { freezes, create } = planMonth(editions, today);

  console.log(`today ${today} (month ${today.slice(0, 7)})`);

  let previousCrossword = null;
  for (const { file, edition } of editions) {
    if (!freezes.includes(edition.week)) continue;
    console.log(`  freeze ${edition.week} (${(edition.articles || []).length} items)`);
    previousCrossword = edition.crossword || previousCrossword;
    if (dryRun) continue;
    edition.status = "frozen";
    edition.frozenAt = new Date().toISOString();
    writeFileSync(file, `${JSON.stringify(edition, null, 2)}\n`);
  }

  if (create) {
    console.log(`  open   ${create}`);
    if (previousCrossword?.number) {
      const copied = publishHeldSolution(previousCrossword.number, { dry: dryRun });
      for (const file of copied) console.log(`  copy   ${file}`);
      if (!copied.length) {
        console.log(`  hold   crossword ${previousCrossword.number} solution files not in data/crossword/`);
      }
    }
    if (!dryRun) {
      mkdirSync(editionsDir, { recursive: true });
      writeFileSync(
        path.join(editionsDir, `${create}.json`),
        `${JSON.stringify(newMonthly(create, { previousCrossword }), null, 2)}\n`
      );
    }
  } else {
    console.log("  open   nothing to create");
  }

  if (!freezes.length && !create) console.log("  nothing to do");
  if (dryRun) console.log("\n(dry run — nothing written)");
}
