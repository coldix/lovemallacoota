import assert from "node:assert/strict";
import test from "node:test";

import { isoWeekOf, melbourneToday, newEdition, plan } from "../tools/roll-edition.mjs";
import { pickBusiness } from "../tools/refresh-weekly.mjs";
import { monthBounds, monthDisplay, newMonthly, nextMonth, planMonth } from "../tools/roll-month.mjs";
import { addIsoDays, comingRange } from "../tools/refresh-weekly.mjs";

const open35 = {
  edition: { week: "2026-w35", weekStart: "2026-08-24", weekEnd: "2026-08-30", status: "open" },
};
const frozen35 = { edition: { ...open35.edition, status: "frozen" } };
const open36 = {
  edition: { week: "2026-w36", weekStart: "2026-08-31", weekEnd: "2026-09-06", status: "open" },
};

test("mid-week, nothing is closed and nothing is opened", () => {
  assert.deepEqual(plan([open35], "2026-08-27"), { freezes: [], create: null });
});

test("on the last day of the week, the week closes and the next one opens", () => {
  assert.deepEqual(plan([open35], "2026-08-30"), {
    freezes: ["2026-w35"],
    create: "2026-w36",
  });
});

test("a missed run recovers the next day rather than skipping a week", () => {
  assert.deepEqual(plan([open35], "2026-08-31"), {
    freezes: ["2026-w35"],
    create: "2026-w36",
  });
});

test("running again after a successful roll changes nothing", () => {
  assert.deepEqual(plan([frozen35, open36], "2026-08-31"), { freezes: [], create: null });
  assert.deepEqual(plan([frozen35, open36], "2026-09-02"), { freezes: [], create: null });
});

test("a frozen edition is never reopened or refrozen", () => {
  const { freezes } = plan([frozen35], "2026-09-20");
  assert.deepEqual(freezes, []);
});

test("the new edition covers Monday to Sunday and starts empty", () => {
  const edition = newEdition("2026-w36");
  assert.equal(edition.weekStart, "2026-08-31");
  assert.equal(edition.weekEnd, "2026-09-06");
  assert.equal(edition.status, "open");
  assert.deepEqual(edition.articles, []);
  assert.equal(edition.displayDate, "31 August 2026");
  assert.equal(isoWeekOf(edition.weekStart), "2026-w36");
  assert.equal(isoWeekOf(edition.weekEnd), "2026-w36");
});

test("the week a date belongs to is the ISO week", () => {
  assert.equal(isoWeekOf("2026-08-24"), "2026-w35");
  assert.equal(isoWeekOf("2026-08-30"), "2026-w35");
  assert.equal(isoWeekOf("2026-08-31"), "2026-w36");
});

test("a weekly roll does nothing while a monthly Coota is open", () => {
  const monthly = {
    edition: {
      week: "2026-09",
      kind: "monthly",
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
      status: "open",
    },
  };
  assert.deepEqual(plan([monthly], "2026-09-06"), { freezes: [], create: null });
  assert.deepEqual(plan([monthly], "2026-09-13"), { freezes: [], create: null });
});

test("a month stays open through its last day and closes the next morning", () => {
  const openSep = {
    edition: {
      week: "2026-09",
      kind: "monthly",
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
      status: "open",
    },
  };
  assert.deepEqual(planMonth([openSep], "2026-09-30"), { freezes: [], create: null });
  assert.deepEqual(planMonth([openSep], "2026-10-01"), {
    freezes: ["2026-09"],
    create: "2026-10",
  });
});

test("running the month roll twice changes nothing", () => {
  const frozenSep = {
    edition: {
      week: "2026-09",
      kind: "monthly",
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
      status: "frozen",
    },
  };
  const openOct = {
    edition: {
      week: "2026-10",
      kind: "monthly",
      monthStart: "2026-10-01",
      monthEnd: "2026-10-31",
      status: "open",
    },
  };
  assert.deepEqual(planMonth([frozenSep, openOct], "2026-10-01"), { freezes: [], create: null });
});

test("a new monthly covers the calendar month and starts empty", () => {
  const edition = newMonthly("2026-09");
  assert.equal(edition.week, "2026-09");
  assert.equal(edition.kind, "monthly");
  assert.equal(edition.monthStart, "2026-09-01");
  assert.equal(edition.monthEnd, "2026-09-30");
  assert.equal(edition.displayDate, "September 2026");
  assert.deepEqual(edition.articles, []);
  assert.deepEqual(monthBounds("2026-02"), { start: "2026-02-01", end: "2026-02-28" });
  assert.equal(nextMonth("2026-12"), "2027-01");
  assert.equal(monthDisplay("2026-10"), "October 2026");
});

test("the next month carries last issue's crossword solution", () => {
  const edition = newMonthly("2026-10", {
    previousCrossword: { number: 2, title: "History and Pioneers" },
  });
  assert.equal(edition.crossword.solutionOfPrevious.number, 2);
  assert.equal(
    edition.crossword.solutionOfPrevious.pages[0],
    "/images/editions/crossword-2-soln-1.webp"
  );
});

test("the featured business in the cool months is not a summer-only operator", () => {
  const featured = pickBusiness("2026-w37");
  assert.equal(featured.slug, "mallacoota-food-chariot");
  assert.equal(featured.rotation, undefined);
  assert.doesNotMatch(featured.description || "", /seasonal/i);
});

test("What's On looks seven days forward from today, not back to Monday", () => {
  assert.deepEqual(comingRange("2026-09-06"), { start: "2026-09-06", end: "2026-09-12" });
  assert.deepEqual(comingRange("2026-12-30"), { start: "2026-12-30", end: "2027-01-05" });
  assert.equal(addIsoDays("2026-09-06", 0), "2026-09-06");
  assert.equal(addIsoDays("2026-09-06", 6), "2026-09-12");
  const today = melbourneToday();
  assert.equal(comingRange().start, today);
  assert.equal(comingRange().end, addIsoDays(today, 6));
});
