# Love Mallacoota

Community information platform, weekly news edition, historical archive, and local guide for [lovemallacoota.au](https://lovemallacoota.au/).

[![Site Version](https://img.shields.io/badge/version-v1.23-0284c7.svg)](data/site-version.json)
[![Build & Test](https://img.shields.io/badge/tests-138%20passing-22c55e.svg)](tests/)

---

## Overview

**Love Mallacoota** is a modern, community-driven digital publication and directory serving residents, visitors, and history enthusiasts of Mallacoota and district (Gipsy Point, Genoa, and East Gippsland).

Historical project documentation and earlier README iterations have been preserved in [`docs/history.md`](docs/history.md).

---

## Platform Features

### 1. This Week (`/edition.html`)
The primary weekly news destination published every Monday (`YY:WK` format, e.g. Edition 26:36).
* **Automated Google Calendar Schedule**: Automated iCal parser (`tools/fetch-calendar.mjs`) fetching and expanding recurring `RRULE` events for the week, formatted into a 1-page compact 2-column print layout.
* **Reordered Back Sections**: Structured flow featuring Classifieds, What's On This Week, Weekly Weather Forecast, Tide Times, Buses and Transport, ending with 3MGB Wilderness Radio strictly last.
* **Local History & Bush Poetry**: Heritage articles, historical photo restorations (e.g. Henry Lawson and E.J. Brady at Captain's Point), and Lawson's 1910 poem *The Bar*.
* **Embedded Audio Narration & Recitals**: HTML5 audio players for local history pieces and poetry recitations (`/audio/*.mp3`), such as Shirley Dixon's recitation of *Farewell to Barbara*, hidden cleanly during printing (`@media print`).
* **Plain Punctuation, Guaranteed**: Every edition is published with straight quotes and hyphens. Text is normalised on submission (`src/submit.ts`), again when editions load (`src/lib/editions.mjs`), and a build test fails on any em dash, curly quote or mojibake in the rendered pages.
* **Contributor Markup**: Bold, italic, links, bullet lists, a `##` subheading, and line breaks kept as typed so a poem or an address is set out the way it was written.
* **Photo Layout and Lightbox**: The first photograph leads each piece, the rest sit in a grid; every picture opens larger in a lightbox that pages through the article's photographs with arrows, keyboard or swipe.
* **Multi-Column Poetry Layout**: Full-width stanza formatting ensuring every verse stays on one line.
* **Community & Editorial**: Local news, notices, classifieds (e.g., gardener wanted notice under Trilogy Care), and contributor submissions.
* **Live Conditions**: Open-Meteo weather forecasts, marine sea-level tides, and lunar cycle indicator.
* **Local Transport**: PTV coach & bus timetables.
* **Weekly Rotations**: Trail of the Week, Business of the Week, and featured videos.
* **Printable PDF & 1-Page Layout**: Automatic server-side rendering of each weekly edition as a formatted A4 document. Headlines are kept with their story, a piece's pictures print as one compact grid between headline and text, section padding is dropped on paper so pieces fill the page, a running footer with page numbers prints from the browser as well as in the PDF, and pictures are re-encoded as JPEG at 1400px so the PDF is a few MB rather than 43MB.
* **Checking the print layout locally**: `pnpm run build`, serve `dist/` on a port, then `Google Chrome --headless=new --no-pdf-header-footer --host-resolver-rules='MAP * ~NOTFOUND, EXCLUDE localhost' --print-to-pdf=out.pdf http://localhost:PORT/edition.html` (blocking outside hosts stops the embeds hanging the render). `pdftoppm -r 28 -png out.pdf pg` gives a thumbnail per page to read as a contact sheet. See [`docs/HANDOVER.md`](docs/HANDOVER.md).

### 2. Article & Event Submissions (`/submit.html` & `/submit-event.html`)
* **Community Submissions**: Anyone can submit articles, notices, or photos via `/submit.html`.
* **Event Submission Form (`/submit-event.html`)**: Features event frequency options (*One-off*, *Weekly*, *Fortnightly*, *Monthly*, *Other*) and recurrence conditions (*Only during school term*, *Does not run on public holidays*, *School holidays only*).
* **Multi-Photo Attachments**: Supports high-resolution photographs per submission with captions and credits.
* **Guest & Contributor Safeguards**:
  * Authenticated contributors are published instantly upon passing automated policy checks.
  * Guest (unauthenticated) submissions require a valid email and phone number, automatically staging photos and placing articles in the `pending_approval` queue in the D1 database.
* **Admin Dashboard (`/admin.html`)**: Maintains an administrative dashboard for single-click review, approval, publishing, or rejection of pending submissions.

### 3. Edna J. Brady *Love of Mallacoota* Collection (`/brady.html`)
* Dedicated interactive page for Edna J. Brady's 1998 100+ page regional history compilation.
* **Split-Pane Interactive Reader**:
  * **Live Search**: Instant client-side filtering across 50+ chapters, poems, photos, and lighthouse memoirs by keyword, author, or title.
  * **Large View Window & Reliable Jump**: 860px tall viewer with query cache-busting (`/pdf/Love-of-Mallacoota.pdf?p=X#page=X&pagemode=none&navpanes=0&view=FitH`) allowing instant jumps and collapsing PDF thumbnail sidebars on load.
* **Credit & Outbound Link**: Gives thanks to Edna J. Brady and the family, featuring a direct link to the official website at [loveofmallacoota.com](https://loveofmallacoota.com/).

### 4. Community Directory (`/directory.html`)
Over 120 verified listings categorized into 5 primary task-based sections:
* **Eat & Drink** ([`/food.html`](https://lovemallacoota.au/food.html)): Cafes, pubs, takeaway, seafood, groceries.
* **Stay** ([`/accom.html`](https://lovemallacoota.au/accom.html)): Lodges, motels, holiday units, caravan parks.
* **Do & See** ([`/activity.html`](https://lovemallacoota.au/activity.html)): Boat hire, tours, attractions, parks.
* **Community** ([`/community.html`](https://lovemallacoota.au/community.html)): Clubs, sports, arts, volunteer groups, 3MGB radio.
* **Services** ([`/services.html`](https://lovemallacoota.au/services.html)): Trades, health, government, police, CFA, SES.
* **Self-Service Verification**: Free listing registration ([`/add-listing.html`](https://lovemallacoota.au/add-listing.html)) and listing claiming ([`/claim.html`](https://lovemallacoota.au/claim.html)) using D1-backed email verification tokens.

### 5. What's On Calendar (`/calendar.html`)
* Community event listings and integrated Google Calendar.
* Public event submission form ([`/submit-event.html`](https://lovemallacoota.au/submit-event.html)).

### 6. Mouth Back-Issue Catalogue (`/mouth.html`)
* Dedicated searchable catalog of historic *Mallacoota Mouth* back-issues (1990s–2020s).
* Search by issue number, date, cover photo credits, or article headlines, with single-year filter tags.

### 7. Archive Hub (`/archive.html`)
* Central historical archive hub for Mallacoota.
* Features the Edna J. Brady collection (`/brady.html`), *The Mallacoota Mouth* back-issue catalogue (`/mouth.html`), and weekly digital editions index.

---

## Site Architecture & Tech Stack

```text
                                 ┌───────────────────────────┐
                                 │    Cloudflare Workers     │
                                 │     (Edge Worker Engine)  │
                                 └─────────────┬─────────────┘
                                               │
               ┌───────────────────────────────┼───────────────────────────────┐
               ▼                               ▼                               ▼
┌──────────────────────────────┐┌──────────────────────────────┐┌──────────────────────────────┐
│     Static Assets (Astro)    ││    D1 SQLite Database (DB)   ││   Browser Rendering API      │
│  - Pre-rendered HTML pages   ││  - Directory Submissions     ││  - On-demand A4 PDF renders  │
│  - Optimized WebP images     ││  - Article Approval Queue    ││    of weekly editions        │
│  - CSS Glassmorphism theme   ││  - Verification Tokens       ││                              │
└──────────────────────────────┘└──────────────────────────────┘└──────────────────────────────┘
```

* **Core Framework**: Astro (Static Site Generation with file-based routing).
* **Server / Edge Runtime**: Cloudflare Workers with TypeScript API routes (`src/worker.ts`, `src/submit.ts`, `src/admin.ts`, `src/listing.ts`).
* **Database**: Cloudflare D1 (`lovemallacoota-directory`) for pending submissions, verification tokens, and audit logs.
* **Design System**: Custom Vanilla CSS featuring an Antigravity Glassmorphism theme with dark/light mode support, vibrant accents, and smooth micro-animations.
* **Image Optimization**: Photographs are converted to WebP with Sharp - submissions by `tools/process-uploads.mjs` (`uploads.yml`), and everything else by the `tools/prepare-*.mjs` scripts.
* **Build Manifest & Versioning**: Version hash and timestamp dynamically generated in `data/site-version.json` and displayed in the site footer stamp.

---

## Information Architecture

```text
Love Mallacoota (lovemallacoota.au)
├── This Week                           /edition.html
│   ├── Local History & Stories
│   ├── Notices & Classifieds
│   ├── Weather, Tides & Moon
│   ├── Transport (PTV Coach/Buses)
│   └── Weekly Features (Trail / Business / Video)
│
├── What's On                           /calendar.html
│   ├── Community Calendar
│   └── Submit an Event                 /submit-event.html
│
├── Directory                           /directory.html
│   ├── Eat & Drink                     /food.html
│   ├── Stay                            /accom.html
│   ├── Do & See                        /activity.html
│   ├── Community                       /community.html
│   ├── Services                        /services.html
│   ├── Add Listing                     /add-listing.html
│   └── Claim Listing                   /claim.html
│
├── Archive Hub                         /archive.html
│   ├── Mallacoota Mouth Catalogue     /mouth.html
│   └── Love of Mallacoota (1998)      /brady.html
│
├── Submissions & Admin
│   ├── Submit Article / Notice         /submit.html
│   └── Admin Approval Dashboard        /admin.html
│
├── Emergency                           /emergency.html
│
└── About & Contribute
    ├── Contact & Corrections           /contact.html
    └── Editorial & Terms               /editorial-policy.html
```

---

## Local Development

### Requirements
* Node.js v22.13+ (see `engines` in `package.json`)
* `pnpm` package manager

### Getting Started

```sh
# 1. Install dependencies
pnpm install

# 2. Run type check & verification
pnpm run check

# 3. Run unit test suite (138 tests)
pnpm run test

# 4. Start local development server
pnpm run dev
```

The site will be served locally at `http://localhost:8787`.

### Local Database Setup (D1)

Apply D1 database migrations locally:

```sh
pnpm wrangler d1 migrations apply lovemallacoota-directory --local
```

---

## Deployment & Rebuilding

Production runs on **Cloudflare Workers** with static asset binding serving `lovemallacoota.au`.

### Build & Versioning

To update the version manifest (`data/site-version.json`) and rebuild the site:

```sh
pnpm run version:site
```

### Deployment Commands

Production is deployed from GitHub Actions, never from a laptop:

```sh
gh workflow run deploy.yml -f target=production
```

**Do not run `pnpm run deploy` locally.** It builds without
`PUBLIC_TURNSTILE_SITE_KEY`, which lives in GitHub secrets, and ships the
always-passes Turnstile test key to production - every form on the site then
accepts anything. The same applies to `pnpm run deploy:preview`; push to `main`
and the workflow deploys the preview for you.

For detailed deployment runbooks, secret configuration, and DNS setup, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Tools

Everything under `tools/` is run by hand or by a workflow; none of it runs at
build time except `build-og.mjs`, `build-static.mjs` and `public-files.mjs`.

| Script | What it does |
| --- | --- |
| `refresh-weekly.mjs` | Builds the automatic half of an edition: forecast, tides, moon, events. `pnpm run weekly` |
| `roll-edition.mjs` | Closes the week and opens the next. `pnpm run roll` |
| `check-images.mjs` | Listing images the data names but the repository lacks; `--gaps` lists listings with no photograph at all. `pnpm run check:images` |

To give a listing a photograph, save it as `images/listings/<slug>.webp` - no
data edit, and it wins over anything the listing data names. Alt text for one of
those goes in `data/listing-photos.json`, keyed by slug; without an entry the
alt text is the listing's name.
| `process-uploads.mjs` | Converts photographs submitted through the form. Run by `uploads.yml`. |
| `prepare-cover.mjs` | One photograph into the two derivatives an edition cover needs. |
| `prepare-article-image.mjs` | One image per article, WebP at 1280px on the longest side. |
| `prepare-bank.mjs` | Adds a photograph to the filler bank at 1920px. |
| `sync-trails.mjs` | Copies TrailBound trails within a two-hour drive. `pnpm run trails:sync` |
| `push-secrets.sh` | Verifies each secret against the service that owns it, then pushes it. |
| `update-version.mjs` | Writes `data/site-version.json`. `pnpm run version:site` |
| `build-og.mjs`, `build-static.mjs`, `public-files.mjs` | Build steps. `public-files.mjs` is the allow-list of what ships. |
| `fetch-calendar.mjs` | Reads the community calendar's iCal feed for the weekly diary. Does nothing until `data/community-calendar.json` names a calendar. |

Three are spent one-shots, kept only as a record of how their images were made:
`import-nas-images.mjs`, `import-stay-images.mjs` and
`convert-uploaded-lawson-photos.mjs`. `import-nas-images.mjs` is the useful one
to read - it maps business photographs on the NAS at
`/Volumes/Media/Docs/OZonLine/A-Businesses` to listing images, and it covered 26
of the 44 folders there.

---

## Documentation Index

- [`docs/history.md`](docs/history.md) - Legacy project history and original README archives.
- [`docs/HANDOVER.md`](docs/HANDOVER.md) - Maintainer handover notes.
- [`docs/EMAIL.md`](docs/EMAIL.md) - Email routing, Turnstile, and relay secret setup.
- [`docs/DIRECTORY.md`](docs/DIRECTORY.md) - Directory schema and management workflows.
- [`docs/WEEKLY-MOUTH.md`](docs/WEEKLY-MOUTH.md) - Weekly edition design decisions.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) - Cloudflare Workers deployment details.
- [`docs/SOCIAL-MEDIA-POST.md`](docs/SOCIAL-MEDIA-POST.md) - Community invitation & outreach social media post templates.
- [`docs/MISSION.md`](docs/MISSION.md) - What the site is for, and what it refuses to be.
- [`docs/DIRECTORY-IA.md`](docs/DIRECTORY-IA.md) - How the directory's sections and tags are shaped.
- [`docs/ARCHIVE.md`](docs/ARCHIVE.md) - The Mouth back-issue archive and its rights position.
- [`docs/GOVERNMENT.md`](docs/GOVERNMENT.md) - Official listings and where their data comes from.
- [`docs/NEXTSTEPS.md`](docs/NEXTSTEPS.md) - A critical review of release v0.07. Largely addressed; kept for the reasoning.

---

## License

* **Code**: MIT License ([`LICENSE`](LICENSE)).
* **Original Content**: Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
* **Archived Materials**: Retained under original rights / historical fair dealing.
