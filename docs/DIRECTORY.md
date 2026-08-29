# Community directory

How the Mallacoota directory is modelled, published and maintained.

Related:

- [`MISSION-COMMUNITY-DIRECTORY.md`](MISSION-COMMUNITY-DIRECTORY.md) — product mission
- [`DIRECTORY-IA.md`](DIRECTORY-IA.md) — public navigation
- [`DIRECTORY-SUBMISSIONS.md`](DIRECTORY-SUBMISSIONS.md) — verification rules
- [`INCORPORATED-ASSOCIATIONS.md`](INCORPORATED-ASSOCIATIONS.md) — CAV seed

## Public IA

Primary nav: Eat & Drink, Stay, Do & See, Community, Services, What's On.

Existing visitor URLs (`/food.html`, `/accom.html`, `/activity.html`, `/calendar.html`) are unchanged. Community and Services are new first-class sections. The whole set is searchable at `/directory.html`. Every listing has a page at `/listing/<slug>.html`.

Shops that used to sit under Do & See now appear under Services.

## Entity model

One entity, many views. `src/lib/directory-model.mjs` is the shared schema. The Astro build loads it through `src/lib/directory.mjs`. The Worker uses the same assemble function over JSON imports.

Sources, in overlay order:

1. Existing visitor files: `data/listings_food.json`, `listings_accom.json`, `listings_do.json`
2. `data/listings_community.json` (Facebook groups) and `data/listings_services.json` (official and health)
3. Registered incorporated associations from `docs/incorporated-associations.json`
4. Per-listing overlays in `data/directory/<slug>.json` — submitted and claimed updates. Same slug wins.

Deregistered associations are not published.

A CAV seed listing publishes legal name, number, status and the register URL only. Phone, email, hours and meeting times are added only from another public source (`data/directory-enrichment.json`) or from a verified submission. The card says so.

## Verification

Shown as a date, never a vague badge:

- `Email verified <date>` — only after a completed emailed code
- `Official source, checked <date>` — government / emergency, last looked at
- `Listed from the Consumer Affairs Victoria register…` — seed, not verified contact
- `Not yet verified` — everything else

A mobile number is supplied, never verified. There is no SMS path.

Official government and emergency listings cannot be claimed or taken over.

## Add, claim, manage

No passwords. The Worker at `/api/listing` handles add, claim and event submissions behind Turnstile, a honeypot and a rate limit.

```text
form  →  email code (15 minutes, hashed in D1)
      →  on success: commit data/directory/<slug>.json
      →  email a 90-day manage link (token stored hashed)
```

Unverified submissions are never published. Official entity types cannot be added through the public form.

Photos are staged to `uploads/` like edition photographs, converted in CI to 1280px WebP at `images/listings/<slug>.webp`. R2 is not enabled on this Cloudflare account, so git remains the staging path.

Pending submissions, codes, manage tokens and an audit trail live in the `lovemallacoota-directory` D1 database. Published business and organisation records stay in git.

## Maintainer load

A club secretary who can receive email at the published address can claim, then update low-risk fields through the manage link. Colin is mailed when:

- a claim has no published email to prove
- an event is confirmed
- publishing to GitHub is not configured

If routine operation needs more than a couple of hours a week, this design is wrong.

## Operating

Apply D1 migrations (once, and on schema change):

```sh
pnpm wrangler d1 migrations apply lovemallacoota-directory --local
pnpm wrangler d1 migrations apply lovemallacoota-directory --remote
```

Adding a missing organisation later is a JSON file in `data/directory/` or a public Add listing — no code change.
