# Love Mallacoota

Community information platform and local guide for
[lovemallacoota.au](https://lovemallacoota.au/). Mallacoota residents and
visitors use the same directory: places to eat, stay and explore, plus clubs,
services, government contacts and what's on.

The project mission is [`docs/MISSION.md`](docs/MISSION.md). The directory
mission, information architecture and operating workflow are:

- [`docs/MISSION-COMMUNITY-DIRECTORY.md`](docs/MISSION-COMMUNITY-DIRECTORY.md)
- [`docs/DIRECTORY-IA.md`](docs/DIRECTORY-IA.md)
- [`docs/DIRECTORY.md`](docs/DIRECTORY.md)
- [`docs/DIRECTORY-SUBMISSIONS.md`](docs/DIRECTORY-SUBMISSIONS.md)

## Current release

The site is a static Astro build served by a Cloudflare Worker. Visitor URLs
(`/food.html`, `/accom.html`, `/activity.html`, `/calendar.html`, `/edition.html`)
are preserved. Community and Services are first-class sections. Every listing
has its own page at `/listing/<slug>.html`. The whole set is searchable at
`/directory.html`.

Primary nav: Eat & Drink, Stay, Do & See, Community, Services, What's On.
This Week, Locals, Archive and Contact live in the footer.

Pushes to `main` deploy the isolated preview Worker. Production deployment of
`lovemallacoota.au` is a deliberate maintainer action.

## Directory

About ninety listings share one entity model (`src/lib/directory-model.mjs`).
Section pages are filtered views of the same records.

| Section | URL | What it holds |
| --- | --- | --- |
| Eat & Drink | `/food.html` | Cafes, pubs, takeaway, seafood, groceries |
| Stay | `/accom.html` | Lodges, motels, holiday houses, caravan parks |
| Do & See | `/activity.html` | Boat hire, tours, attractions |
| Community | `/community.html` | Clubs, sport, arts, volunteer groups, local media |
| Services | `/services.html` | Trades, shops, health, government, emergency |
| What's On | `/calendar.html` | Community calendar, this week's edition, event form |
| Whole directory | `/directory.html` | Search and filters across every listing |

Shops that used to sit under Do & See now appear under Services.

Government and emergency listings are marked **Official**, use the matching
schema.org type (not LocalBusiness), and cannot be claimed. Incorporated
associations seeded from Consumer Affairs Victoria show legal name and number
only until a representative confirms contact details. No phone or hours are
invented from a register name.

### Add, claim, update

Free. No accounts or passwords.

1. [Add your listing](https://lovemallacoota.au/add-listing.html) — the form
   adapts by organisation type.
2. A six-digit code is emailed to the public address given. Unverified
   submissions are never published.
3. After the code, the listing is committed to git and a private manage link
   is emailed. The link expires; claim the listing again to get a new one.
4. Existing listings carry **Claim this listing**. Official services cannot
   be taken over.

Pending submissions, codes, manage tokens and an audit trail live in the
`lovemallacoota-directory` D1 database. Published records stay in git. Photos
are staged to `uploads/` and converted in CI to 1280px WebP.

See [`docs/DIRECTORY.md`](docs/DIRECTORY.md) for the data model and maintainer
runbook.

## Structure

- `src/pages/` — Astro routes. `build.format: "file"` keeps `.html` URLs.
- `src/components/` and `src/layouts/` — navigation, footer, directory UI.
- `src/lib/directory-model.mjs` and `src/lib/directory.mjs` — unified listings.
- `src/listing.ts` — add / claim / verify / manage / event Worker APIs.
- `src/worker.ts` — redirects, security headers, `/api/*` routes.
- `data/` — listing JSON. `data/directory/` holds submitted overlays.
- `migrations/` — D1 schema for directory submissions.
- `docs/` — mission, directory IA, CAV seed, government research. Not deployed.
- `tools/` — public-file allow-list, version stamp, photo conversion.

## Local development

```sh
pnpm install
pnpm run check
pnpm run dev
```

The site is served locally at `http://localhost:8787`. Apply D1 migrations once:

```sh
pnpm wrangler d1 migrations apply lovemallacoota-directory --local
```

Build output is written to `dist/` from the allow-list in
`tools/public-files.mjs`.

## Deployment

Production is a Cloudflare Worker with static assets. Canonical domain:
`lovemallacoota.au`. `www` redirects to the apex.

```sh
pnpm run deploy:preview   # isolated workers.dev preview
pnpm run deploy           # lovemallacoota.au
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for DNS, email-record
preservation, cutover and rollback.

## Versioning

Run this before publishing content changes:

```sh
pnpm run version:site
```

The script writes `data/site-version.json` from public site files: a `v0.01`-style
version, a Melbourne timestamp, and a SHA-256 for each deployed file. Normal
updates increment by `.01`. For a major release:

```sh
node tools/update-version.mjs --major
```

The footer reads this manifest and displays the current version.

## Forms and mail

The suggest-an-update form posts to `/api/submit` ([`src/contact.ts`](src/contact.ts)).
Directory add/claim/event posts to `/api/listing` ([`src/listing.ts`](src/listing.ts)).
Both require Turnstile (verified server side), a honeypot, and a per-IP rate
limit. No sending credential is exposed to the browser.

Delivery goes through the adnet relay at `https://ads.oze.net.au/relay`. The
Cloudflare login for this account cannot enable Email Sending on
`lovemallacoota.au`; the account behind adnet already sends. The relay knows the
recipient; this Worker cannot choose it.

Setup, once:

```sh
openssl rand -base64 32
npx wrangler secret put RELAY_KEY --env=""
npx wrangler secret put TURNSTILE_SECRET_KEY --env=""
```

Put the Turnstile **site** key in `.env` as `PUBLIC_TURNSTILE_SITE_KEY` (see
[`.env.example`](.env.example)), and in the `PUBLIC_TURNSTILE_SITE_KEY` GitHub
Actions secret so CI builds with it. Without it the build falls back to
Cloudflare's always-passes test key, which is correct locally and wrong in
production.

Everything fails closed: a missing key, a failed challenge or a relay error
returns an error rather than silently dropping the message.

## Licence

Code is MIT ([`LICENSE`](LICENSE)). Original content is CC BY 4.0; submitted and
archived material is not. See [`CONTENT-LICENCE.md`](CONTENT-LICENCE.md).

## GitHub

```sh
origin https://github.com/coldix/lovemallacoota.git
```
