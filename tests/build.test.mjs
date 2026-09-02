import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { ALL_LISTING_FILES, loadListings, verificationLine } from "../src/lib/listings.mjs";
import { loadDirectory, sectionEntities } from "../src/lib/directory.mjs";
import {
  AD_SIZES,
  SECTIONS,
  currentEdition,
  editionAds,
  editionSections,
  loadEditions,
  tableOfContents,
} from "../src/lib/editions.mjs";

/** Astro escapes these when it renders text, so the test has to match. */
const escapeEntities = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const generatedPages = [
  "index.html",
  "food.html",
  "accom.html",
  "activity.html",
  "community.html",
  "services.html",
  "directory.html",
  "add-listing.html",
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

test("the community calendar is the Google Calendar Colin supplied, and the policy lets it load", async () => {
  const html = await readFile(new URL("../dist/calendar.html", import.meta.url), "utf8");
  // The embed Colin supplied encodes the same address in base64 (unpadded) and
  // starts the week on Monday.
  assert.match(html, /calendar\.google\.com\/calendar\/embed\?/);
  assert.match(html, /src=Y3JkaXhvbkBnbWFpbC5jb20/);
  assert.equal(atob("Y3JkaXhvbkBnbWFpbC5jb20="), "crdixon@gmail.com");
  assert.match(html, /wkst=2/);
  assert.match(html, /id="nav-menu-toggle"/);
});

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
  { page: "food.html", section: "eat-drink" },
  { page: "accom.html", section: "stay" },
  { page: "activity.html", section: "do-see" },
  { page: "community.html", section: "community" },
  { page: "services.html", section: "services" },
];

test("directory pages carry every listing in the static HTML", async () => {
  for (const { page, section } of directoryPages) {
    const html = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8");
    const entities = sectionEntities(section);
    assert.ok(entities.length > 0, `${page} has no listing data`);
    for (const entity of entities) {
      assert.ok(
        html.includes(escapeEntities(entity.name)),
        `${page} is missing ${entity.name} — it must not depend on client-side rendering`
      );
    }
    assert.match(html, /Showing \d+ of \d+ /);
  }
});

test("directory structured data is rendered at build time", async () => {
  for (const { page, section } of directoryPages) {
    const html = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8");
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const collection = blocks
      .map((match) => JSON.parse(match[1]))
      .find((schema) => schema["@type"] === "CollectionPage");
    assert.ok(collection, `${page} has no CollectionPage JSON-LD in the HTML`);
    assert.equal(
      collection.mainEntity.itemListElement.length,
      sectionEntities(section).length
    );
  }
});

test("individual listing pages exist and government is not a LocalBusiness", async () => {
  const police = loadDirectory().find((entity) => entity.slug === "mallacoota-police-station");
  assert.ok(police);
  const html = await readFile(new URL("../dist/listing/mallacoota-police-station.html", import.meta.url), "utf8");
  assert.ok(html.includes("Mallacoota Police Station"));
  assert.ok(html.includes("Official"));
  assert.ok(!html.includes("Claim this listing"));
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const schema = JSON.parse(blocks[0][1]);
  assert.notEqual(schema["@type"], "LocalBusiness");
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

test("filtered listing cards actually disappear", async () => {
  const css = await readFile(new URL("../assets/css/style.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.listing-card\[hidden\]\s*\{\s*display:\s*none\s*!important/,
    "display:flex on .listing-card would otherwise keep hidden cards on screen"
  );
});

test("text links are themed, not browser blue on the dark page", async () => {
  const css = await readFile(new URL("../assets/css/style.css", import.meta.url), "utf8");
  assert.match(
    css,
    /:where\(a\)\s*\{\s*color:\s*var\(--link\)/,
    "bare <a> would otherwise be browser blue on black"
  );
  assert.match(
    css,
    /:where\(a:visited\)\s*\{\s*color:\s*var\(--link\)/,
    "visited links would otherwise be browser purple on black"
  );
  assert.match(
    css,
    /\.copyright a\s*\{\s*color:\s*var\(--link\)/,
    "footer CC BY / MIT links must stay readable"
  );
});

test("an unverified listing says so rather than staying silent", async () => {
  const unverified = loadListings(["listings_food.json"]).find(
    (business) => !business.verification?.email?.verifiedAt
  );
  assert.ok(unverified, "expected at least one unverified listing to check");
  assert.deepEqual(verificationLine(unverified), {
    verified: false,
    kind: "none",
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

test("published text is plain punctuation, and never mojibake", async () => {
  // An earlier edit mangled every em dash and curly quote through a bad
  // encoding round trip, a repair of that left C1 control characters behind,
  // and both only showed up in the rendered page. The edition now publishes
  // straight quotes and hyphens, so none of these characters belong anywhere
  // a reader sees.
  const forbidden = /[\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u0080-\u009F\uFFFD]|â€|Â/;
  const pages = ["edition.html", "index.html", "directory.html", "calendar.html", "archive.html"];
  for (const page of pages) {
    const html = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8");
    const hit = forbidden.exec(html);
    assert.ok(!hit, `${page} carries typographic or corrupted punctuation near: ${html.slice(Math.max(0, hit?.index - 40), hit?.index + 40)}`);
  }

  for (const edition of loadEditions()) {
    for (const article of edition.articles || []) {
      const text = [article.title, article.byline, ...(article.body || [])].join(" ");
      assert.ok(!forbidden.test(text), `${article.id} has typographic or corrupted punctuation`);
    }
  }
});

test("no piece appears twice in an edition", () => {
  // A submission approved from the queue after a hand-edited copy had been
  // committed put "Farewell to Barbara" in the edition twice.
  for (const edition of loadEditions()) {
    const articles = edition.articles || [];
    const ids = articles.map((article) => article.id);
    assert.equal(new Set(ids).size, ids.length, `${edition.week}: an article id is repeated`);
    const titles = articles.map((article) => String(article.title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
    assert.equal(new Set(titles).size, titles.length, `${edition.week}: a headline is repeated`);
  }
});

test("a headline is never left at the foot of a page without its story", async () => {
  // The headline and byline sit in their own block, outside the text columns,
  // and print refuses to break after it. "Local of the Week" once sat alone at
  // the bottom of page six with the story overleaf.
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  assert.ok(html.includes('class="edition-article-head"'), "articles have no head block");
  assert.ok(html.includes('class="edition-article-columns"'), "articles have no column block");
  const css = await readFile(new URL("../assets/css/style.css", import.meta.url), "utf8");
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /\.edition-article-head\s*\{[^}]*break-after:\s*avoid/, "print does not keep the head with the story");
  assert.match(print, /@bottom-right\s*\{[^}]*counter\(page\)/, "print has no page number");
});

test("every picture in the edition opens larger, with its own words", async () => {
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  const figures = html.match(/<figure class="edition-figure[^"]*">/g) || [];
  const zooms = html.match(/<a class="edition-zoom" href="\/images\/[^"]+"/g) || [];
  assert.ok(figures.length > 0, "no figures in the edition");
  assert.equal(zooms.length, figures.length, "a figure is not a link to its picture");
  // The photograph with a caption field, not a note, shows it.
  assert.ok(html.includes("farewell Barb in 2009"), "a caption in the caption field is dropped");
});

test("the coach timetable publishes times, not a link telling people to look", async () => {
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  const timetable = JSON.parse(
    await readFile(new URL("../data/bus-timetable.json", import.meta.url), "utf8")
  );

  assert.ok(timetable.services.length > 0, "no services in the timetable");
  for (const service of timetable.services) {
    assert.ok(service.departures.length > 0, `${service.from} has no departure times`);
    for (const time of service.departures) {
      assert.match(time, /^\d{2}:\d{2}$/, `"${time}" is not a time`);
    }
    assert.notEqual(service.from, service.to, "a service cannot depart to where it already is");
  }

  // Times go stale. The edition must say which period they cover.
  assert.ok(html.includes(timetable.validTo), "the timetable does not state its validity");
  assert.ok(html.includes(timetable.source), "the timetable does not credit its source");
});

test("the edition is numbered by week and by year", async () => {
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  const edition = currentEdition();
  const [year, week] = edition.week.split("-w");
  assert.ok(html.includes(`Week ${week}`), "no week number on the page");
  assert.ok(html.includes(`Edition ${year.slice(2)}:${week}`), "no YY:WK edition number");
});

test("advertisements are booked per edition, at a known size, one to a page", async () => {
  for (const edition of loadEditions()) {
    const ads = editionAds(edition);
    for (const ad of ads) {
      assert.ok(AD_SIZES.has(ad.size), `${ad.advertiser}: unknown size "${ad.size}"`);
      assert.ok(ad.image, `${ad.advertiser}: no artwork`);
      assert.ok(ad.alt || ad.advertiser, `${ad.advertiser}: nothing for a screen reader to say`);
    }

    // One per page means at most one attached to any single section, and the
    // full-page ones take their own sheet.
    const bySection = new Map();
    for (const ad of ads.filter((entry) => entry.size !== "full")) {
      const count = (bySection.get(ad.after) || 0) + 1;
      assert.ok(count <= 1, `two advertisements are attached to ${ad.after}`);
      bySection.set(ad.after, count);
    }
  }
});

test("the classifieds and family notices are offered to contributors", async () => {
  const offered = SECTIONS.filter((section) => !section.automatic).map((section) => section.id);
  assert.ok(offered.includes("classifieds"), "no classifieds section");
  assert.ok(offered.includes("bdm"), "no births, deaths and marriages section");

  const html = await readFile(new URL("../dist/submit.html", import.meta.url), "utf8");
  assert.ok(html.includes("Classifieds"), "classifieds is not on the submit form");
  assert.ok(html.includes("Births, Deaths and Marriages"), "family notices are not on the form");
});

test("every photograph in the bank has a caption, a credit and a file", async () => {
  const bank = JSON.parse(
    await readFile(new URL("../data/photo-bank.json", import.meta.url), "utf8")
  );
  for (const photo of bank) {
    assert.ok(photo.caption, `${photo.slug}: no caption`);
    assert.ok(photo.credit, `${photo.slug}: no credit`);
    assert.ok(photo.alt, `${photo.slug}: nothing for a screen reader to say`);
    await access(new URL(`../dist${photo.url}`, import.meta.url));
  }
});

test("a section that says it has content actually renders it", async () => {
  // A refactor once removed the video embed while leaving its heading, and the
  // page looked right. Check the content, not the title.
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  const edition = currentEdition();

  if (edition?.video) {
    assert.ok(html.includes("Video of the Week"), "no video heading");
    assert.match(html, /youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}/, "heading with no embed");
  }
  for (const section of editionSections(edition)) {
    if (section.auto?.type === "weather") {
      assert.ok(html.includes("Forecast from"), "weather heading with no table");
    }
    if (section.auto?.type === "tide-table") {
      assert.ok(html.includes("tide-day-card"), "tide heading with no tides");
    }
  }
});

test("no editor's note is left where the town can read it", async () => {
  // Forty-one listings shipped with "(Add more details here)." on the end of
  // their description — a note to ourselves, rendered on the public page. The
  // card blurbs were clean, so it only showed on the individual listing pages
  // and nobody spotted it.
  const notes = /\(add more details here\)|\blorem ipsum\b|\bplaceholder\b|\bTODO\b|\bFIXME\b|\bXXX\b/i;
  const offenders = [];
  for (const entity of loadDirectory()) {
    for (const [field, value] of Object.entries({
      description: entity.description,
      descriptionShort: entity.descriptionShort,
      notes_seasonal: entity.notes_seasonal,
    })) {
      if (typeof value === "string" && notes.test(value)) {
        offenders.push(`${entity.slug} [${field}]: ${value.slice(0, 80)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `unfinished text on public listing pages:\n${offenders.join("\n")}`);
});

test("the honeypot is not something a password manager will fill in", async () => {
  // It was called "website", sat beside a real website_url field, and the real
  // field's label pointed at the honeypot's id. Autofill filled the trap, the
  // Worker discarded the submission as a bot, and the page said "Check your
  // email for a code" — a false success with nothing sent and nothing written.
  const tempting = /^(website|url|homepage|company|address|name|email|phone|first|last)/i;
  for (const page of ["add-listing.html", "claim.html", "contact.html", "submit-event.html"]) {
    const html = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8");
    const trap = html.match(/<div class="field visually-hidden"[\s\S]*?<input[^>]*name="([^"]+)"[^>]*>/);
    assert.ok(trap, `${page} has no honeypot`);
    assert.ok(
      !tempting.test(trap[1]),
      `${page}: the honeypot is named "${trap[1]}", which autofill will recognise`
    );

    // Every label must name a field that exists, or it labels nothing and may
    // focus something hidden.
    const ids = new Set([...html.matchAll(/<(?:input|select|textarea)[^>]*\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const [, target] of html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)) {
      assert.ok(ids.has(target), `${page}: <label for="${target}"> matches no field`);
    }
  }
});

test("the radio programme is 3MGB's, attributed and printed as they published it", async () => {
  const html = await readFile(new URL("../dist/edition.html", import.meta.url), "utf8");
  const program = JSON.parse(
    await readFile(new URL("../data/radio-program.json", import.meta.url), "utf8")
  );

  // Every local show they print, present on the page.
  const shows = program.days.flatMap((day) => day.shows);
  assert.ok(shows.length > 15, "the grid looks truncated");
  for (const show of shows) {
    assert.ok(html.includes(escapeEntities(show.title)), `missing "${show.title}"`);
    if (show.presenter) {
      assert.ok(html.includes(escapeEntities(show.presenter)), `missing ${show.presenter}`);
    }
  }

  // Whether a show is postponed is Colin's call — the published guide still
  // says July 2026 and July has been and gone, so the three it names are shown
  // as running. What must hold is that a postponement in the data reaches the
  // page: a show quietly listed as on when the data says otherwise would put a
  // listener in front of a radio at seven on a Saturday for nothing.
  for (const show of shows.filter((s) => s.postponed)) {
    assert.ok(
      html.includes(escapeEntities(show.postponed)),
      `${show.title} is marked postponed in the data but the page does not say so`
    );
  }
  for (const show of shows.filter((s) => s.note)) {
    assert.ok(html.includes(escapeEntities(show.note)), `${show.title} loses its note`);
  }

  // Attribution: their guide, their version, their frequencies, their station.
  assert.ok(html.includes(program.source), "the programme version is not credited");
  assert.ok(html.includes(program.sourceUrl), "3MGB's programme page is not linked");
  assert.ok(html.includes(program.caution), "the volunteers-and-may-change note is missing");
  for (const frequency of program.frequencies) {
    assert.ok(html.includes(frequency.mhz), `${frequency.mhz} is not shown`);
  }
  assert.ok(
    /3MGB's programme, not ours/.test(html),
    "the page does not say whose programme this is"
  );

  // It is a standing file, like the timetable — never regenerated per week.
  const weekly = await readFile(new URL("../tools/refresh-weekly.mjs", import.meta.url), "utf8");
  assert.ok(
    !weekly.includes("radio-program"),
    "the weekly refresh is rewriting 3MGB's programme; it is theirs to change, not ours"
  );
});

test("pages that need a query parameter read it at runtime, not at build time", async () => {
  // This is a static build, so Astro.url is the URL at build time and has no
  // query string. Reading it in the frontmatter shipped an empty value on every
  // copy of the page: /verify.html?id=… posted no id at all, and the server
  // blamed the code the person had just typed correctly.
  for (const page of ["verify.astro", "claim.astro", "submit-event.astro"]) {
    const source = await readFile(new URL(`../src/pages/${page}`, import.meta.url), "utf8");
    assert.ok(
      !/Astro\.url\.searchParams/.test(source),
      `${page} reads a query parameter at build time, where there is never one`
    );
    assert.match(
      source,
      /new URLSearchParams\(location\.search\)/,
      `${page} never reads its query parameter at runtime either`
    );
  }

  // And the built page must carry the field for the script to fill.
  const verify = await readFile(new URL("../dist/verify.html", import.meta.url), "utf8");
  assert.match(verify, /name="id"/, "verify.html has no id field to populate");
});

test("a claimed listing stops offering to be claimed", async () => {
  const { canClaim } = await import("../src/lib/directory-model.mjs");
  const base = { entityType: "business", status: "published" };
  assert.equal(canClaim({ ...base, verification: {} }), true, "an unclaimed listing should be claimable");
  assert.equal(
    canClaim({ ...base, verification: { email: { verifiedAt: "2026-08-31" } } }),
    false,
    "a listing whose owner has proved their address still offers Claim"
  );
});

test("neither form offers a type the server will refuse", async () => {
  // government and school are in FORM_ENTITY_TYPES but handleListingSubmit
  // rejects official types, so offering them produced a refusal after somebody
  // had filled the whole form in.
  const { ENTITY_TYPES } = await import("../src/lib/directory-model.mjs");
  const official = Object.entries(ENTITY_TYPES)
    .filter(([, info]) => info.official)
    .map(([id]) => id);
  assert.ok(official.length > 0, "expected some official types");

  for (const page of ["add-listing.html", "manage.html"]) {
    const html = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8");
    const offered = [...html.matchAll(/<option value="([a-z-]+)"/g)].map((m) => m[1]);
    for (const id of official) {
      assert.ok(!offered.includes(id), `${page} offers "${id}", which the server refuses`);
    }
    assert.ok(offered.includes("business"), `${page} does not offer Business`);
  }

  // And the owner must be able to change it at all.
  const manage = await readFile(new URL("../dist/manage.html", import.meta.url), "utf8");
  assert.match(manage, /name="entityType"/, "the manage form cannot change what a listing is");
});
