# NEXT-STEPS.md

**Love Mallacoota — critical review and next steps**

|  |  |
| :---- | :---- |
| Version | v0.01 |
| Created | 28/08/2026 08:34 AEST |
| Reviewed release | `v0.07`, live at [https://lovemallacoota.au](https://lovemallacoota.au) |
| Reviewed commit | `75d0691` Document production deployment |
| Reviewer | Claude Opus 5 |
| Status | For Colin's decision |

---

## 1\. Credit where it is due

Codex has done a lot in about ten hours. The Astro conversion is clean, the component split is sensible, the Worker redirect logic is correct and tested, the preview and production environments are properly separated, the build uses an explicit allow-list so nothing private leaks, and the policy pages including the emergency page match the mission almost word for word. The version and checksum manifest works. `docs/REBUILD-PLAN.md` is an honest progress log.

The architecture is right. What follows is about the gap between the architecture and what is actually being served.

---

## 2\. Critical review

### 2.1 Blocking. Fix before anything else.

**F1. Every listing image on the site is a broken link.**

The listing JSON contains 41 image references, all pointing at `/images/bus/eat/...`, `/images/bus/act/...` and similar. That directory does not exist in the repository, and `tools/public-files.mjs` does not include it in the deploy allow-list. Even if the files exist on your Mac Studio, they are not committed and would not deploy.

image refs: 41   missing on disk: 41

Fix: find the originals, commit them under `images/bus/`, add `"images/bus"` to `publicDirectories` in `tools/public-files.mjs`, and add a build test that fails if any referenced image is absent. Until then every card renders with a hole in it.

**F2. The directory is invisible to search engines and to AI crawlers. This is the big one.**

`food.html`, `accom.html` and `activity.html` ship an empty `<div id="listings-grid">`. The businesses are fetched by `assets/js/script.js` at runtime. I fetched the live `https://lovemallacoota.au/food.html` and got back zero business names.

You are running Astro, a static site generator, and then not letting it generate the thing that matters. Your entire competitive position against visitmallacoota.com.au is "we will win by being the best". Being the best is worth nothing if the pages that carry your content are blank to a crawler.

Google will sometimes render JavaScript, at lower priority and with no guarantee. Bing is worse. The AI crawlers you deliberately invited in `llms.txt` and `robots.txt` do not run JavaScript at all, so the `llms.txt` welcome mat currently leads to an empty room.

Fix: import the listing JSON in the Astro frontmatter and render the cards at build time. Keep the JavaScript for search and tag filtering only, operating on markup that is already in the page. This is a small change with a large effect.

**F3. The structured data is injected by JavaScript too.**

`injectCategorySchema()` builds good `LocalBusiness` JSON-LD, with addresses and coordinates, and then appends it to the head at runtime. Same problem as F2, and it wastes the best asset in the project. Render the JSON-LD server side in the Astro layout.

**F4. The contact form is unprotected and is the only submission channel you have.**

`contact.astro` posts straight to EmailJS from the browser with the public key in the page source, no Turnstile, no rate limit, and a third-party script loaded from jsdelivr. The EmailJS free tier is a couple of hundred messages a month. One bot will drain it in an afternoon, and after that the form fails quietly for real people and you will not know.

Fix: move the form to a `/api/submit` Worker route with Turnstile validated server side. Codex already has this as Phase 5\. It should be Phase 1, because the form is live now.

### 2.2 High value, low effort

**F5. No per-listing pages.** Every record already has a `slug`, a `schema_type`, an address, coordinates, a description and images. That is 44 pages of unique, genuinely local content sitting in JSON doing nothing. Generate `/business/alfs-pizza.html` and so on from Astro's dynamic routes. Each becomes a page a business can link to from its own site and Facebook, each carries its own JSON-LD, each is a separate entry in the sitemap. For a directory competing on search, this is the single highest return change on the list.

**F6. `sitemap.xml` and `robots.txt` are hand-maintained static files.** The sitemap already carries `lastmod` dates of 2026-07-14 on pages rebuilt yesterday. Generate both at build time. Once F5 lands there will be sixty-odd URLs and hand maintenance stops being realistic.

**F7. `run_worker_first: true` runs the Worker on every single request.** Every image, every stylesheet, every JSON file pays a Worker invocation and a little latency, so that a handful of redirect paths can be caught. Scope `run_worker_first` to the paths that need it and let static assets serve straight from the edge.

**F8. `/` and `/index.html` both return 200\.** Duplicate content. Add `/index.html` to the redirect map.

**F9. Missing security headers.** You set four headers but not `Strict-Transport-Security` and not a `Content-Security-Policy`. With Google Analytics, Google Fonts, jsdelivr, EmailJS, YouTube, Google Maps and `ads.oze.net.au` all loading, a CSP is real protection and not just a box to tick.

**F10. `data/listings_other.json` is a bare object where the other three files are arrays.** It only works because `Array.prototype.flat()` leaves a non-array element alone. Fold the RSL Bunker Museum record into `listings_do.json` and delete the file.

**F11. The calendar is a Google Calendar iframe bound to your personal Gmail account.** The account id is sitting in the page source, base64 encoded, in plain view. Three problems: the events are not indexable so you get no search value from them, there is no `Event` structured data, and a platform you have promised to hand over to the community is anchored to your personal Google account. Move to a `data/events.json` file rendered by Astro, with an ICS feed generated for people who want a subscription.

**F12. There is no link to trailbound.au anywhere on the site.** Covered in section 4\.

### 2.3 Consistency with the mission

**F13. The footer says "All rights reserved".** `docs/MISSION.md` commits to MIT for code and CC BY 4.0 for content. Those two statements contradict each other on every page of the site.

**F14. There is no LICENSE file in the repository.** "Open by default" is not open until the licence is in the repo. Add `LICENSE` (MIT) and a `CONTENT-LICENCE.md`.

**F15. `docs/MISSION.md` is a mangled paste.** It came back through Google Docs, so the tables have collapsed into tab-separated fragments and your comments are mixed into the body text. Your annotations are good and several are decisions, not comments. They should be folded in properly and the file rewritten as clean markdown at v0.02.

Your annotations that need a decision recorded:

- Nobody will come forward to help unless paid. If that is right, then "volunteer moderation" is not a plan and the design must assume one paid or self-interested operator. That changes Section 3 materially.  
- A Substack-style commenting section. This sits directly against "not a Facebook group". Pick one and write it down.  
- Campaigning for better local services and funding, and calling out waste. This is a significant change to "not a newspaper" and "no taking sides". It may well be the right call, but it is the thing critics will use, so the boundary needs to be written precisely rather than left as a note.  
- A subscriber model at $5 a month, free for twelve months, or a donate button. Worth adding to Section 9 as an option, not a commitment.  
- @mallacootanow needs less than one moderation action a month across thousands of users. That is strong evidence for a trusted-contributor model where approved people publish straight through. Record it, it justifies the design.

**F16. Ads are on the homepage only.** `showAds` is set on `index.astro` and nowhere else. The directory pages are where a local business ad actually belongs. The emergency and policy pages must stay clean, which the mission requires and the current setup happens to achieve by accident. Make it a rule in code, not an accident.

---

## 3\. The business and trades directory

### 3.1 Should you scrape Yellow Pages or White Pages?

No. Not because you cannot, but because it is the worse option on every axis that matters.

**The legal picture, briefly.** In *Telstra Corporation Ltd v Phone Directories Company Pty Ltd* \[2010\] FCA 44, upheld by the Full Federal Court later that year, the court found no copyright subsists in the White Pages or Yellow Pages, because the directories were compiled by computer with no identifiable human authors. So the raw facts are on weaker ground than people assume.

That is not the end of it. Both sites' terms of use prohibit automated extraction, which is a contract question rather than a copyright one. The written descriptions, category text and photographs in a Yellow Pages listing are authored work and are protected. And the Privacy Act still applies to how you collect and hold personal contact details, particularly for sole traders where the business contact is a person.

I am not a lawyer and this is not legal advice. But the short version is that the legal risk is real enough to matter and the upside is small.

**The practical picture is what actually settles it.** Yellow Pages data for a town of about a thousand people is stale. Businesses that closed after the 2019-20 fires are still listed. Businesses that started since are not. Phone numbers are wrong. A directory that is wrong is worse than a directory that is small, because being right is your whole pitch against the incumbent. Scraped data also gives you no relationship with the business, and the relationship is what later sells an ad.

### 3.2 What to do instead: seed, verify, then open submissions

A submission form alone starts empty and stays empty, because nobody submits to a blank page. So do both, in this order.

**Step 1\. Seed from legitimate sources.**

- **ABN Lookup bulk extract**, published on data.gov.au by the Australian Business Register. Free, official, openly licensed, and filterable by postcode. Pull every active ABN registered at 3892 and every trading name. This gives you legal entity names, entity type, GST status and ABN status. It does not give phone numbers or addresses, so it is a spine, not a finished listing.  
- **The Mallacoota Mouth archive.** The old issues are full of trades ads. That is a curated list of local businesses, with phone numbers, assembled by people who knew the town. This is the best seed source you have and you already want the archive for other reasons. Two jobs, one scan.  
- **Your own knowledge and the Facebook groups.** For a town this size, one afternoon with a notepad beats any dataset.  
- **East Gippsland Shire and local association listings**, where they are published for public use.

**Step 2\. Verify by hand before publishing.** Ring or check each one. Publish nothing you have not confirmed. Fifty verified trades beats four hundred scraped ones, and it is a claim you can make out loud.

**Step 3\. Open submissions and claiming.** Once there is something on the page, add:

- "Add your business" — a submission form  
- "Claim this listing" — on every business page, so the owner can take ownership and keep it current  
- "Suggest a correction" — on every business page  
- A `last_verified` date on every listing, shown publicly

That last one is quietly the strongest thing on the list. "Verified 14 August 2026" on every card is something visitmallacoota almost certainly does not do, and it turns accuracy from a claim into a visible fact.

**Step 4\. Structure trades properly.** Add a `trades` category alongside food, stay and do, and give it real subcategories rather than a tag soup: builder, electrician, plumber, mechanic, arborist, mowing and landscaping, cleaning, painter, plasterer, concreter, roofing, fencing, septic and drainage, pest control, marine and boat services, firewood, waste and removals, computer and IT, bookkeeping and admin, hairdressing and beauty, allied health, vet, real estate, storage, freight and courier.

Add fields the existing schema does not have and trades need: `service_area` (many tradies come from Genoa, Cann River or Eden), `abn`, `licence_number` for electrical and plumbing, `last_verified`, and `claimed_by`.

### 3.3 The one scraping-adjacent thing worth doing

Do not scrape directories. Do consider a build-time link checker that fetches each listing's own website and flags dead links and changed phone numbers for you to review. That is checking your own data against the source of truth, not copying someone else's compilation, and it is the kind of automation that keeps a directory accurate with almost no ongoing effort.

---

## 4\. Where TrailBound belongs

Do not scatter links around. Three placements, each one earning its position, plus a reciprocal link back.

**4.1 A dedicated `/trails.html` page on Love Mallacoota. This is the important one.**

Not a redirect. A real page, owned by Love Mallacoota, titled for the search people actually do: walks and trails around Mallacoota. It carries a short editorial introduction, the ten or so walks in the immediate area with a line each on distance, difficulty and where the track starts, and each one links through to its full TrailBound page for the map, the detail and the conditions.

This is the correct structure for two reasons. Love Mallacoota owns the local intent query and keeps the visitor. TrailBound owns the trail detail and gets a genuinely relevant inbound link. Two sites both rank, and neither is a thin doorway page.

Add it to the main navigation as "Walks", or fold it under "Do & See" if the nav is getting crowded.

**4.2 On `activity.html`.** A panel above the listings, not buried in "Keep Exploring": walking and hiking around Mallacoota, with the three or four best-known walks named and a link to `/trails.html`.

**4.3 On the homepage.** One card in the Explore the Directory grid, alongside Eat & Drink, Stay, Do & See and What's On. It belongs at that level. Visitors search for walks as often as they search for food.

**4.4 Reciprocal, from TrailBound.** Each TrailBound trail page in the Mallacoota area should link back to Love Mallacoota for food, accommodation and town services. That is a real service to a walker planning a trip, which is what makes it a defensible link rather than a manufactured one.

**One caution.** You own both sites, so keep the links editorial and in context. Do not put a sitewide boilerplate link block in the footer of every page across the network. Cross-linking sites you own is fine when each link is useful to the reader on the page it sits on. Sitewide footer link blocks between owned domains are a recognised pattern and not a good one.

---

## 5\. Proposed release plan

Version numbers follow the existing `.01` increment. Every release runs `pnpm run version:site` before publishing.

### v0.08 — Fix what is broken (do this first)

1. Restore the missing listing images and add `images/bus` to the deploy allow-list  
2. Add a build test that fails when a referenced image is missing  
3. Render listings and JSON-LD at build time in Astro; keep the JavaScript for filtering only  
4. Move the contact form to a Worker `/api/submit` route with Turnstile  
5. Fold `listings_other.json` into `listings_do.json`  
6. Redirect `/index.html` to `/`  
7. Add `LICENSE` (MIT) and fix the footer copyright line to match the mission

### v0.09 — Per-listing pages and generated metadata

1. Generate a page per business from the existing slugs  
2. Per-page `LocalBusiness` JSON-LD, breadcrumbs, images with correct dimensions  
3. Generate `sitemap.xml` and `robots.txt` at build time  
4. Add `last_verified` to the data model and display it on every listing  
5. Scope `run_worker_first`; add HSTS and a Content-Security-Policy

### v0.10 — TrailBound integration

1. Build `/trails.html` with the Mallacoota-area walks  
2. Add the activity page panel and the homepage card  
3. Add the reciprocal links from TrailBound's Mallacoota trail pages

### v0.11 — Trades and services directory

1. Add the trades category, subcategories and the extra fields  
2. Seed from ABN Lookup and the Mouth archive advertisements  
3. Verify by hand, publish only what is confirmed  
4. Add "Add your business", "Claim this listing" and "Suggest a correction" forms

### v0.12 — Events off Google Calendar

1. `data/events.json` rendered by Astro, with `Event` structured data  
2. Generated ICS feed so people can still subscribe  
3. Event submission form  
4. Retire the personal Google Calendar embed

### After that

Newsletter, submission moderation dashboard and the Mouth archive, broadly as Codex has them in `docs/REBUILD-PLAN.md`. Those phases are well specified and I would not change them much, except to say that the newsletter should wait until there is something worth sending every week. An empty digest going out on schedule does more damage than no digest.

---

## 6\. Two things in the current plan I would push back on

**The dates are too tight.** The rebuild plan has the submission and moderation workflow operational by 14 September and the first newsletter in late September. That is achievable only if nothing else happens. Right now the site is serving broken images and blank directory pages, which is a worse problem than anything in Phases 4 to 7\. Get the existing pages correct before adding new surfaces.

**"Low effort to run" is in tension with your own annotation.** You wrote that nobody will come forward unless paid. If that is true, then every design decision needs to assume one person, occasionally busy, sometimes away for a month. That argues for fewer content types, more automation, and the trusted-contributor model your @mallacootanow observation supports, rather than a moderation queue that needs someone to sit at it. Worth settling before Phase 5 gets built.

---

## Change log

| Version | Date and time (AEST) | Change |
| :---- | :---- | :---- |
| v0.01 | 28/08/2026 08:34 | Initial review of release v0.07 at commit 75d0691 |

