# Love Mallacoota

Community information platform, weekly news edition, historical archive, and local guide for [lovemallacoota.au](https://lovemallacoota.au/).

[![Site Version](https://img.shields.io/badge/version-v0.86-0284c7.svg)](data/site-version.json)
[![Build & Test](https://img.shields.io/badge/tests-125%20passing-22c55e.svg)](tests/)

---

## Overview

**Love Mallacoota** is a modern, community-driven digital publication and directory serving residents, visitors, and history enthusiasts of Mallacoota and district (Gipsy Point, Genoa, and East Gippsland).

Historical project documentation and earlier README iterations have been preserved in [`docs/history.md`](docs/history.md).

---

## Platform Features

### 1. This Week (`/edition.html`)
The primary weekly news destination published every Monday (`YY:WK` format, e.g. Edition 26:36).
* **Local History**: Heritage articles, historical photo restorations (e.g. Henry Lawson and E.J. Brady at Captain's Point), and regional memoirs.
* **Community & Editorial**: Local news, notices, classifieds, and contributor pieces.
* **Live Conditions**: Open-Meteo weather forecasts, marine sea-level tides, and lunar cycle indicator.
* **Local Transport**: PTV coach & bus timetables.
* **Weekly Rotations**: Trail of the Week, Business of the Week, and featured videos.
* **Printable PDF**: Automatic server-side rendering of each weekly edition as a formatted A4 document.

### 2. Article Submissions & Admin Dashboard (`/submit.html` & `/admin.html`)
* **Community Submissions**: Anyone can submit articles or historical notices via `/submit.html`.
* **Multi-Photo Attachments**: Supports up to 3 high-resolution photographs per submission with captions and credits.
* **Guest & Contributor Safeguards**:
  * Authenticated contributors are published instantly upon passing automated policy checks.
  * Guest (unauthenticated) submissions require a valid email and phone number, automatically staging photos and placing articles in the `pending_approval` queue in the D1 database.
* **Admin Dashboard (`/admin.html`)**: Maintains an administrative dashboard for single-click review, approval, publishing, or rejection of pending submissions.

### 3. Edna J. Brady *Love of Mallacoota* Collection (`/brady.html`)
* Dedicated interactive page for Edna J. Brady's 1998 100+ page regional history compilation.
* **Split-Pane Interactive Reader**:
  * **Live Search**: Instant client-side filtering across 50+ chapters, poems, photos, and lighthouse memoirs by keyword, author, or title.
  * **Embedded PDF Viewer**: `#page=X` deep-linking allows users to click any page pill (e.g. `p. 60` for Henry Lawson) to update the embedded viewer directly.
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
* Features the Edna J. Brady collection (`/brady.html`), *The Mallacoota Mouth* back-issue catalogue (`/mouth.html`), weekly digital editions index, and *Local of the Week* profile archive.

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
* **Image Optimization**: Automated conversion of uploaded photos to WebP format via Sharp (`tools/convert-uploaded-lawson-photos.mjs`, `uploads.yml`).
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
* Node.js v18+
* `pnpm` package manager

### Getting Started

```sh
# 1. Install dependencies
pnpm install

# 2. Run type check & verification
pnpm run check

# 3. Run unit test suite (125 tests)
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

```sh
# Deploy to preview environment (workers.dev)
pnpm run deploy:preview

# Deploy to live production (lovemallacoota.au)
pnpm run deploy
```

For detailed deployment runbooks, secret configuration, and DNS setup, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Documentation Index

- [`docs/history.md`](docs/history.md) - Legacy project history and original README archives.
- [`docs/HANDOVER.md`](docs/HANDOVER.md) - Maintainer handover notes.
- [`docs/EMAIL.md`](docs/EMAIL.md) - Email routing, Turnstile, and relay secret setup.
- [`docs/DIRECTORY.md`](docs/DIRECTORY.md) - Directory schema and management workflows.
- [`docs/WEEKLY-MOUTH.md`](docs/WEEKLY-MOUTH.md) - Weekly edition design decisions.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) - Cloudflare Workers deployment details.

---

## License

* **Code**: MIT License ([`LICENSE`](LICENSE)).
* **Original Content**: Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
* **Archived Materials**: Retained under original rights / historical fair dealing.
