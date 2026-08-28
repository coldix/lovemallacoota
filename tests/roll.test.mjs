import assert from "node:assert/strict";
import test from "node:test";

import { isoWeekOf, newEdition, plan } from "../tools/roll-edition.mjs";

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
