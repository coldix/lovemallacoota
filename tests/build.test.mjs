import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { loadListings } from "../src/lib/listings.mjs";
import {
  SECTIONS,
  currentEdition,
  loadEditions,
  tableOfContents,
} from "../src/lib/editions.mjs";

/** Astro escapes these when it renders text, so the test has to match. */
const escapeEntities = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

const directoryPages = [
  { page: "food.html", files: ["listings_food.json"] },
  { page: "accom.html", files: ["listings_accom.json"] },
  { page: "activity.html", files: ["listings_do.json"] },
];

test("directory pages carry every listing in the static HTML", async () => {
  for (const { page, files } of directoryPages) {
    const html = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8");
    const businesses = loadListings(files);
    assert.ok(businesses.length > 0, `${page} has no listing data`);
    for (const business of businesses) {
      assert.ok(
        html.includes(escapeEntities(business.business_name)),
        `${page} is missing ${business.business_name} — it must not depend on client-side rendering`
      );
    }
    assert.match(html, /Showing \d+ of \d+ places/);
  }
});

test("LocalBusiness structured data is rendered at build time", async () => {
  for (const { page, files } of directoryPages) {
    const html = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8");
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const collection = blocks
      .map((match) => JSON.parse(match[1]))
      .find((schema) => schema["@type"] === "CollectionPage");
    assert.ok(collection, `${page} has no CollectionPage JSON-LD in the HTML`);
    assert.equal(
      collection.mainEntity.itemListElement.length,
      loadListings(files).length
    );
  }
});

test("every image the built pages reference is actually deployed", async () => {
  const pages = [...generatedPages];
  const missing = [];
  for (const page of pages) {
    const html = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8");
    const referenced = new Set();
    for (const match of html.matchAll(/(?:src|href)="(\/[^"]+\.(?:webp|jpg|jpeg|png|svg|ico))"/g)) {
      referenced.add(match[1]);
    }
    for (const match of html.matchAll(/"image":\s*"https:\/\/lovemallacoota\.au([^"]+)"/g)) {
      referenced.add(match[1]);
    }
    for (const url of referenced) {
      try {
        await access(new URL(`../dist${url}`, import.meta.url));
      } catch {
        missing.push(`${page} → ${url}`);
      }
    }
  }
  assert.deepEqual(missing, [], `referenced images are not in the build:\n${missing.join("\n")}`);
});

test("the contact form uses the configured Turnstile site key", async () => {
  const html = await readFile(new URL("../dist/contact.html", import.meta.url), "utf8");
  assert.match(html, /class="cf-turnstile" data-sitekey="[^"]+"/);

  const configured = process.env.PUBLIC_TURNSTILE_SITE_KEY;
  if (!configured) return; // Local builds fall back to the always-passes test key.

  assert.ok(
    html.includes(`data-sitekey="${configured}"`),
    "the build did not pick up PUBLIC_TURNSTILE_SITE_KEY — the form would ship with the test key"
  );
});

test("the weekly edition is rendered into the HTML, not fetched", async () => {
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  const editions = loadEditions();
  const current = currentEdition(editions);
  assert.ok(current, "no edition to render");

  for (const article of current.articles) {
    assert.ok(
      html.includes(escapeEntities(article.title)),
      `edition.html is missing "${article.title}"`
    );
  }

  // The table of contents links every article it lists.
  for (const section of tableOfContents(current)) {
    assert.ok(html.includes(`#section-${section.id}`), `no ToC link for ${section.title}`);
    for (const entry of section.entries) {
      assert.ok(html.includes(`#${entry.id}`), `no ToC link for ${entry.title}`);
    }
  }
});

test("sections with no contributions are left out of the edition", async () => {
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  const used = new Set((currentEdition().articles || []).map((article) => article.section));
  for (const section of SECTIONS) {
    if (used.has(section.id)) continue;
    assert.ok(
      !html.includes(`id="section-${section.id}"`),
      `empty section ${section.title} should not be rendered`
    );
  }
});

test("every edition keeps its own permanent page", async () => {
  for (const edition of loadEditions()) {
    const html = await readFile(
      new URL(`../dist/edition/${edition.week}.html`, import.meta.url),
      "utf8"
    );
    assert.match(html, new RegExp(`<link rel="canonical" href="https://lovemallacoota\\.au/edition/${edition.week}\\.html"`));
  }
});
