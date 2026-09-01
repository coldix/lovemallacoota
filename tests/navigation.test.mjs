/*
# Project:     lovemallacoota.au
# File Name:   navigation.test.mjs
# Description: The navigation, the metadata and the share cards, checked
#              against the built HTML rather than against the components that
#              produce it. Every one of these has been wrong at some point in a
#              way that only showed up in the rendered page.
*/

import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { loadDirectory, listingDescription, listingTitle } from "../src/lib/directory.mjs";
import { loadEditions } from "../src/lib/editions.mjs";
import { sitemapEntries } from "../src/pages/sitemap.xml.js";

const dist = new URL("../dist/", import.meta.url);
const read = (page) => readFile(new URL(page, dist), "utf8");

/** Every HTML page the build produced, as paths relative to dist. */
async function allPages(dir = "", into = []) {
  for (const entry of await readdir(new URL(dir, dist), { withFileTypes: true })) {
    const relative = `${dir}${entry.name}`;
    if (entry.isDirectory()) await allPages(`${relative}/`, into);
    else if (entry.name.endsWith(".html")) into.push(relative);
  }
  return into;
}

const meta = (html, property) =>
  html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`))?.[1];

test("This Week leads the navigation, and the directory follows it", async () => {
  const html = await read("index.html");
  const bar = html.match(/<div class="nav-inline">([\s\S]*?)<\/div>/)[1];
  const labels = [...bar.matchAll(/>([^<>]+)<\/a>/g)].map((match) => match[1].trim());
  assert.deepEqual(labels, [
    "This Week",
    "What&#39;s On",
    "Directory",
    "Eat &amp; Drink",
    "Stay",
    "Do &amp; See",
  ]);
});

test("Emergency is one press away on every page, never buried", async () => {
  for (const page of ["index.html", "food.html", "edition.html", "archive.html"]) {
    const html = await read(page);
    // First link in the menu, before the grouped lists.
    const menu = html.match(/<div id="nav-menu"[^>]*>([\s\S]*?)<button id="theme-toggle"/)[1];
    const emergency = menu.indexOf('href="/emergency.html"');
    assert.ok(emergency > -1, `${page} has no emergency link in the menu`);
    assert.ok(
      emergency < menu.indexOf('href="/archive.html"'),
      `${page} buries Emergency below the rest of the menu`
    );
    assert.match(html, /nav-menu-emergency/, `${page} does not mark the emergency link`);
  }
});

test("the retired Locals page is gone from the build and from every menu", async () => {
  await assert.rejects(access(new URL("locals.html", dist)), "locals.html is still built");
  for (const page of await allPages()) {
    const html = await read(page);
    assert.ok(
      !html.includes('href="/locals.html"'),
      `${page} still links to the retired /locals.html`
    );
  }
  assert.ok(
    !sitemapEntries("2026-01-01").some((entry) => entry.path === "/locals.html"),
    "the sitemap still lists /locals.html"
  );
});

test("Local of the Week section is removed from archive.html", async () => {
  const html = await read("archive.html");
  assert.ok(!html.includes('id="archive-locals-title"'), "Local of the Week title should be removed from archive.html");
});

test("every page carries its own title, description and canonical", async () => {
  const seenTitles = new Map();
  const seenDescriptions = new Map();
  for (const page of await allPages()) {
    const html = await read(page);
    const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const description = meta(html, "description");
    assert.ok(title, `${page} has no title`);
    assert.ok(description, `${page} has no description`);
    assert.match(html, /<link rel="canonical" href="https:\/\/lovemallacoota\.au\//);
    seenTitles.set(title, [...(seenTitles.get(title) || []), page]);
    seenDescriptions.set(description, [...(seenDescriptions.get(description) || []), page]);
  }
  for (const [title, pages] of seenTitles) {
    assert.equal(pages.length, 1, `${pages.length} pages share the title "${title}": ${pages}`);
  }
  for (const [description, pages] of seenDescriptions) {
    assert.equal(
      pages.length,
      1,
      `${pages.length} pages share a description: ${pages.join(", ")}`
    );
  }
});

test("one h1 per page, and it says what the page is about", async () => {
  for (const page of await allPages()) {
    const html = await read(page);
    const headings = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
    assert.equal(headings.length, 1, `${page} has ${headings.length} h1 elements`);
    const text = headings[0][1].replace(/<[^>]+>/g, "").trim();
    assert.ok(text.length > 2, `${page} has an empty h1`);
  }
});

test("a listing's title and description are built from its own record", async () => {
  for (const entity of loadDirectory()) {
    const title = listingTitle(entity);
    const description = listingDescription(entity);
    assert.ok(title.includes(entity.name.slice(0, 24)), `${entity.slug}: title lost the name`);
    assert.ok(title.length <= 62, `${entity.slug}: title is ${title.length} characters`);
    assert.ok(
      description.length >= 55 && description.length <= 160,
      `${entity.slug}: description is ${description.length} characters`
    );
  }
});

test("no page falls back to a bare logo for its share card", async () => {
  const cards = new Set();
  for (const page of await allPages()) {
    const html = await read(page);
    const image = meta(html, "og:image");
    assert.ok(image, `${page} has no og:image`);
    assert.ok(
      !/logo|og-hero/.test(image),
      `${page} shares a logo rather than a picture: ${image}`
    );
    assert.ok(meta(html, "og:image:alt"), `${page} has no alt text for its share card`);
    assert.equal(meta(html, "og:url"), `https://lovemallacoota.au${page === "index.html" ? "/" : `/${page}`}`);
    cards.add(image);
  }
  // The point of the exercise: pages do not all share one picture.
  assert.ok(cards.size >= 10, `only ${cards.size} distinct share cards across the site`);
});

test("every share card is a real file at the Open Graph size", async () => {
  const pages = await allPages();
  const cards = new Set(
    (await Promise.all(pages.map(read)))
      .map((html) => meta(html, "og:image"))
      .map((url) => url.replace("https://lovemallacoota.au", ""))
  );
  for (const card of cards) {
    await access(new URL(`.${card}`, dist));
  }
  for (const page of pages) {
    const html = await read(page);
    if (!meta(html, "og:image").includes("/images/og/")) continue;
    assert.equal(meta(html, "og:image:width"), "1200", `${page}: wrong declared width`);
    assert.equal(meta(html, "og:image:height"), "630", `${page}: wrong declared height`);
  }
});

test("breadcrumbs match the navigation, and start at Home", async () => {
  const expected = {
    "food.html": ["Home", "Directory", "Eat & Drink"],
    "accom.html": ["Home", "Directory", "Stay"],
    "edition.html": ["Home", "This Week"],
    "archive.html": ["Home", "Archive"],
    "calendar.html": ["Home", "What's On"],
    "emergency.html": ["Home", "Emergency"],
    "listing/mallacoota-bakery.html": ["Home", "Directory", "Eat & Drink", "Mallacoota Bakery"],
  };
  for (const [page, names] of Object.entries(expected)) {
    const html = await read(page);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1]));
    const crumbs = blocks.find((schema) => schema["@type"] === "BreadcrumbList");
    assert.ok(crumbs, `${page} has no BreadcrumbList`);
    assert.deepEqual(crumbs.itemListElement.map((step) => step.name), names);
    // The visible trail has to say the same thing as the structured one.
    const nav = html.match(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav, `${page} has no visible breadcrumb trail`);
    for (const name of names) {
      assert.ok(
        nav.includes(name.replace(/&/g, "&amp;").replace(/'/g, "&#39;")),
        `${page}: the visible trail is missing "${name}"`
      );
    }
  }
});

test("the sitemap lists only pages the build produced and lets be indexed", async () => {
  const entries = sitemapEntries("2026-01-01");
  for (const entry of entries) {
    const page = entry.path === "/" ? "index.html" : entry.path.replace(/^\//, "");
    const html = await read(page);
    assert.doesNotMatch(
      meta(html, "robots") || "",
      /noindex/,
      `the sitemap lists ${entry.path}, which asks not to be indexed`
    );
  }
  const paths = new Set(entries.map((entry) => entry.path));
  assert.equal(paths.size, entries.length, "the sitemap lists a page twice");
});

test("a page that says noindex is not linked from the navigation", async () => {
  const home = await read("index.html");
  const nav = home.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)[0];
  for (const page of await allPages()) {
    const html = await read(page);
    if (!/noindex/.test(meta(html, "robots") || "")) continue;
    assert.ok(
      !nav.includes(`href="/${page}"`),
      `the navigation links to ${page}, which asks not to be indexed`
    );
  }
});

test("the featured business points at its own listing, not at a section it is not in", async () => {
  const html = await read("edition.html");
  const week = loadEditions().find((edition) => edition.status === "open");
  const weekly = JSON.parse(
    await readFile(new URL(`../data/weekly/${week.week}.json`, import.meta.url), "utf8")
  );
  if (!weekly.business?.slug) return; // no business featured this week

  assert.ok(
    html.includes(`href="/listing/${weekly.business.slug}.html"`),
    "the business of the week does not link to its own listing"
  );
  // It used to send everyone to Eat & Drink, whatever the business was.
  const feature = html.match(/<div class="edition-auto edition-feature">(?:(?!<\/div>)[\s\S])*?Not paid placement/);
  assert.ok(feature, "no featured business block found");
  assert.ok(
    !feature[0].includes('href="/food.html"'),
    "the featured business still links to Eat & Drink regardless of its section"
  );
});

test("the footer keeps the free listing apart from the things that cost money", async () => {
  const html = await read("index.html");
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
  const free = footer.match(/aria-label="Add or update"[\s\S]*?<\/nav>/)[0];
  const paid = footer.match(/aria-label="Support the site"[\s\S]*?<\/nav>/)[0];
  assert.ok(free.includes('href="/add-listing.html"'));
  assert.ok(!free.includes("/advertise"), "advertising is listed beside the free listing links");
  assert.ok(paid.includes('href="/advertise"') && paid.includes('href="/subscribe"'));
});
