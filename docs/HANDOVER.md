# Handover — 9 September 2026

Live release **v1.85** at [lovemallacoota.au](https://lovemallacoota.au).
Deployed from GitHub, run [34222874408](https://github.com/coldix/lovemallacoota/actions/runs/34222874408),
commit `fe4a8a0`. The week-36 PDF was re-rendered the same evening.

The previous handover, written 5 September, is in the git history at
`docs/HANDOVER.md` before this commit.

---

## Read this before you deploy

**Deploy from GitHub, never from this machine.**

```
gh workflow run deploy.yml -f target=production
```

`pnpm run deploy` builds without `PUBLIC_TURNSTILE_SITE_KEY`, which lives in
repository secrets, and ships the test key to production. That is exactly what
went wrong on 3 and 4 September.

**Check the push succeeded before you dispatch the deploy.** A push was rejected
on 5 September while the scheduled weekly job held the branch, and the deploy
fired anyway — it went out green, from origin, without the commit. The same
thing nearly happened tonight: `weekly.yml` landed `13ee549` on main while this
machine was committing v1.85. Rebase, rebuild the version hashes
(`pnpm run build && node tools/update-version.mjs --files`), then push. Then
dispatch. The workflow says "success" because it deployed *something*. Read the
run's `headSha`. Tonight it was `fe4a8a0`.

A push to main deploys **preview** only, unless the push carries
`data/directory/` or `data/editions/`. Print CSS and Worker changes need the
dispatch.

---

## What this session did

The week-36 PDF at `/edition/2026-w36.pdf` was a year-cached render from early
6 September. The page had already moved on. The file still had:

- last week's weather, tides and What's On (Monday 31 August)
- Adobe Holiday Flats as Business of the Week (it is Food Chariot)
- photographs clipped to 36–50mm boxes, some missing, pairs stacked at most of
  a page

Print now shows photographs **whole**. No overflow clip, no `object-fit: cover`
(cover makes Chromium rasterise a new bitmap and store it uncompressed). Two to
a row; a pair (original and reconstruction, two portraits) side by side; a
five-picture set leads across the measure then 2×2; a wide landscape sits beside
a small portrait. Grids may break between rows so a set does not jump a whole
page and leave the previous one blank.

The live PDF was checked after deploy: created 8 September 21:53 AEST, Food
Chariot, Sunday 6 – Saturday 12 September, 19 pages.

**Print this edition** in the browser uses the page. **Download the PDF** is
the Worker render. They are the same HTML.

---

## Frozen PDFs and `PDF_LAYOUT`

A frozen edition's PDF is cached for a year (`CACHE_SECONDS_FROZEN` in
`src/edition-pdf.ts`). That is right for the *content*. It is wrong for the
*layout*.

The Worker cache key includes `PDF_LAYOUT` (currently `"3"`). **Bump that
string when print CSS changes**, or the old PDF stays. Do not change the public
URL.

```
src/edition-pdf.ts  →  const PDF_LAYOUT = "3";
```

The response also sends `Cache-Control: public, max-age=31536000`. After a
layout bump the Worker cache misses and the first request re-renders (about
10–15 seconds). If an old file is still coming back, purge that one URL rather
than waiting a year.

---

## Checking the print layout locally

```
pnpm run build
# serve dist/ on a port
Google Chrome --headless=new --no-pdf-header-footer \
  --host-resolver-rules='MAP * ~NOTFOUND, EXCLUDE localhost' \
  --print-to-pdf=out.pdf \
  http://localhost:PORT/edition/2026-w36.html
pdftoppm -r 40 -png out.pdf pg
pdftotext -layout out.pdf - | grep -E "Food Chariot|Sun 6 Sept|Adobe Holiday|Mon 31 Aug"
```

Blocking outside hosts stops the YouTube embeds hanging the render. Read the
thumbnails as a contact sheet. `pdftotext` is how you catch last week's weather
without opening every page.

---

## Still true

**Coota 26:09 is the live monthly.** Week 36 (6–12 September, Sunday start) is
closed at `/edition/2026-w36.html` with a PDF at `/edition/2026-w36.pdf`.
`roll.yml` has no schedule. Crossword no. 2 is on 26:09; its solution is held
in `data/crossword/` for 26:10. Month-end freeze is `month.yml`, dispatch-only
until it has been run by hand once.

**What's On is the next seven days from today** (`data/weekly/coming.json`),
written by `weekly.yml` at 15:10 Melbourne, which deploys production itself. A
frozen week keeps `data/weekly/<week>.json` — week 36's weather, tides, diary
and Food Chariot do not move. The calendar page and the open monthly do.

Tonight, 9 September, `coming.json` still starts 8 September. The test "What's
On shows the next seven days from today" fails locally until the 15:10 job
runs. That is a stale file, not a code bug. Do not "fix" it by editing the
dates by hand.

**Deploy from GitHub.** The 5 September form test still stands: a real listing
went through Turnstile, D1, mail and GitHub write, and the live site key
matched the Worker secret. Do not repeat `pnpm run deploy` from this machine.

**The Coota calendar is what the paper prints.** The 5 September handover
records the import, what was left out, and that the 2025 calendar is not
evidence of frequency. Read that in git if you are touching events.

---

## Where things are

| Thing | Where |
| --- | --- |
| Deploy | `gh workflow run deploy.yml -f target=production`, never locally |
| Version and README stamp | `pnpm run version:site` writes both; a test fails if they disagree |
| Print CSS | `assets/css/style.css`, the `@media print` blocks |
| PDF cache bust | `PDF_LAYOUT` in `src/edition-pdf.ts` — bump when print CSS changes |
| Week 36 | `/edition/2026-w36.html` and `/edition/2026-w36.pdf` |
| What's New record | `pnpm run changes`, and automatically as the first build step |
| Community calendar id | `data/community-calendar.json`, with partner calendars beside it |
| Listing photographs | `images/listings/<slug>.webp`, alt text keyed by **filename**, not slug |
| Coordinates wanted | `docs/coordinates-wanted.md` |
