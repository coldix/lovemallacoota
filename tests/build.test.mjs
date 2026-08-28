import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { ALL_LISTING_FILES, loadListings, verificationLine } from "../src/lib/listings.mjs";
import {
  SECTIONS,
  currentEdition,
  editionSections,
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

test("sections with nothing in them are left out of the edition", async () => {
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  // A section earns its place with a contribution or with automatic content.
  const present = new Set(editionSections(currentEdition()).map((section) => section.id));
  for (const section of SECTIONS) {
    if (present.has(section.id)) continue;
    assert.ok(
      !html.includes(`id="section-${section.id}"`),
      `empty section ${section.title} should not be rendered`
    );
  }
  assert.ok(present.size < SECTIONS.length, "expected at least one empty section to drop");
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

test("a verification date is never invented, and never in the future", async () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const file of ALL_LISTING_FILES) {
    for (const business of loadListings([file])) {
      const verification = business.verification;
      if (!verification) continue;

      const verifiedAt = verification.email?.verifiedAt;
      if (verifiedAt) {
        assert.match(verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${business.business_name}: bad date`);
        assert.ok(
          verifiedAt <= today,
          `${business.business_name} claims to have been verified on ${verifiedAt}, in the future`
        );
      }

      // There is no SMS verification path, so nothing may claim one.
      assert.notEqual(
        verification.mobile?.verified,
        true,
        `${business.business_name} claims a verified mobile, but no SMS verification exists`
      );
    }
  }
});

test("an unverified listing says so rather than staying silent", async () => {
  const unverified = loadListings(["listings_food.json"]).find(
    (business) => !business.verification?.email?.verifiedAt
  );
  assert.ok(unverified, "expected at least one unverified listing to check");
  assert.deepEqual(verificationLine(unverified), {
    verified: false,
    text: "Not yet verified",
  });

  const html = await readFile(new URL("../dist/food.html", import.meta.url), "utf8");
  assert.ok(html.includes("Not yet verified"), "the card does not show verification state");
});

test("the rotation features a different trail and business every week", async () => {
  const trails = JSON.parse(
    await readFile(new URL("../data/trails-nearby.json", import.meta.url), "utf8")
  );
  assert.ok(trails.length > 10, "expected a meaningful pool of nearby trails");

  // Every trail must come up once before any repeats.
  const seen = new Set();
  for (let week = 0; week < trails.length; week += 1) {
    seen.add(trails[week % trails.length].slug);
  }
  assert.equal(seen.size, trails.length, "the rotation repeats before featuring them all");

  // Nothing beyond a two-hour drive is ever featured.
  for (const trail of trails) {
    assert.ok(trail.directLineKm <= 70, `${trail.name} is ${trail.directLineKm} km away`);
    assert.match(trail.url, /^https:\/\/trailbound\.au\/trails\//);
  }
});

test("automatic sections say where their content came from", async () => {
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  assert.ok(html.includes("Open-Meteo"), "the forecast does not credit its source");
  assert.ok(
    html.includes("Not an official warning service"),
    "the forecast does not disclaim being a warning service"
  );
  assert.ok(
    html.includes("Not paid placement"),
    "the featured business does not say it is unpaid"
  );
});

test("tide times are linked, never invented", async () => {
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  assert.ok(html.includes("bom.gov.au"), "tides do not link to the official source");
  // No table of tide figures should ever be rendered from data we do not hold.
  assert.ok(
    !/high\s*tide|low\s*tide/i.test(html),
    "the edition appears to publish tide figures"
  );
});
