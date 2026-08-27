import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const generatedPages = [
  "index.html",
  "food.html",
  "accom.html",
  "activity.html",
  "calendar.html",
  "archive.html",
  "contact.html",
  "emergency.html",
  "editorial-policy.html",
  "corrections.html",
  "accessibility.html",
  "privacy.html",
  "terms.html",
  "404.html",
];

test("Astro produces every public route with canonical metadata", async () => {
  for (const page of generatedPages) {
    const html = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8");
    assert.match(html, /<title>.+<\/title>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/lovemallacoota\.au\//);
  }
});

test("private archive source material is excluded from the public build", async () => {
  await assert.rejects(access(new URL("../dist/docs/Edition 1771 18th June 2020 Electronic Version.pdf", import.meta.url)));
});
