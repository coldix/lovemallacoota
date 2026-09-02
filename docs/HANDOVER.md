# Handover — 2 September 2026

Live release **v1.10** at [lovemallacoota.au](https://lovemallacoota.au).
133 tests passing. Written for whoever picks this up next (Colin said Opus 5).

---

## Evening of 2 September: the edition page, reviewed

Colin read the live edition and listed what was wrong. Every item is fixed and guarded by a test.

- **Mojibake, again.** The previous repair replaced the first byte of each corrupted quote with an em dash and left the two control bytes behind, so the page showed a dash and an invisible pair after every apostrophe. Fixed at the source, and the edition now publishes plain punctuation everywhere: straight quotes, a spaced hyphen for a dash, three dots for an ellipsis. `plainPunctuation()` in `src/lib/markup.mjs` repairs both known mojibake shapes and flattens the rest. It runs on submission, on every edition when it loads, and the build test fails on any of those characters in the rendered pages. The site's own templates and data files were purged of them too.
- **"Farewell to Barbara" twice.** The queue approval committed the raw submission, then a hand-edited copy with the photograph and recital was committed beside it. The duplicate is gone, and `appendArticle()` in `src/submit.ts` now refuses a second copy of the same id or headline.
- **The poem ran together.** The renderer folded single newlines into spaces. A line break typed by the contributor is now kept, a line beginning `##` is a subheading, and the stanzas were regrouped by their rhyming couplets (the submission had them cut at every fourth line).
- **Pictures.** The first photograph leads a piece; the rest sit in a grid. Every picture is a link to itself, and the lightbox pages through an article's photographs.
- **Print.** Headline and byline now live in their own block outside the text columns, and print refuses to break after it. "Local of the Week" no longer sits alone at the foot of a page. A running footer with `Page n of m` prints from the browser (Chrome 131+ page margin boxes); the PDF route keeps its own footer and switches those off. Print columns fill in order rather than balancing, which is what moved the story onto the same page as its headline.
- **The PDF was 43MB.** Chromium stores a WebP as raw pixels. The PDF route now re-encodes each picture as JPEG in the page before printing, so the bytes pass straight through. Not yet measured on the live Worker; the logic was run in a browser against the built page, where 68MB of pixels became 4.2MB of JPEG.

Two things found and left: `data/coota-new.json` is not valid JSON (nothing reads it), and the console messages in `tools/*.mjs` still use em dashes (they are never published).

## Later that evening: the printed edition, page by page

The live PDF after the first push was 7.5MB and 20 pages. Rendering every page
as a thumbnail and reading them as a contact sheet showed where the paper was
going: a lone picture in column one with column two empty beside it, whole
pieces pushed to a fresh page with a third of the previous one blank, the
contents spilling three lines onto the editorial page, section headings
("Births, Deaths and Marriages", "Around the Socials") stranded at a page foot,
and the radio programme leaving Sunday alone on a last page. It is now 16 pages
and every heading sits with its content. What changed, and why, in the order it
was found:

- **Pictures at 1400px** in `src/edition-pdf.ts` (was 1800). More than enough
  for a 92mm column at 300dpi.
- **Several pictures print as one grid between headline and text**, two across,
  three across when there are four or more, capped at 50mm and 36mm. On screen
  the first picture still leads full-width above the grid (`.edition-figure.lead`
  spans the grid). A lone picture stays in its column, capped at 80mm on paper.
- **The grid sits outside the column container.** As the first child of the
  multicol it was a spanner, and Chromium would not start such a piece mid-page.
- **Section padding is zero on paper.** `.content-block` carried 12mm above and
  below every heading and 10mm beneath each section. That, not the break rules,
  was why a headline, its pictures and three lines of text kept missing the
  space left on a page. This was the single biggest improvement.
- **`column-fill: auto`** on the text columns, so a piece that crosses a page
  fills column one before column two instead of leaving it empty.
- **Classifieds and family notices** use the same head-then-columns structure
  as every other piece, three columns of 9pt.
- **Contents**: three columns, bylines hidden on paper (they are in the pieces).
- **Around the Socials**: the link cards were a CSS grid, which Chromium prints
  as one unbreakable block. On paper they are plain blocks that break between
  cards, so the heading keeps its first cards.
- **Radio**: three flowing CSS columns rather than a row grid, so the seven days
  balance and the whole programme, its source line and the closing footer share
  one page. Four across was tried and was worse: narrow columns wrap every title.
- **Still deliberate**: the weather page is half blank because the tide chart
  and table print as one block on the next page, and the bus page is half blank
  because the radio programme does. Both are one-page automatic sections and
  were designed that way.

### Two things the deploy taught, after the push

**A push without edition data does not reach production.** The v1.10 push ran
the deploy workflow, it reported success, and the site kept serving v1.09: the
workflow only publishes production on its own for a push carrying
`data/directory/**` or `data/editions/**`. Anything else needs
`gh workflow run deploy.yml -f target=production`. It is in "Where things are"
below and was easy to forget while watching the run go green.

**The scheduled refresh failed on its first run after the punctuation guard.**
The calendar feed sends curly apostrophes ("Senior Women's Exercise Class"),
`tools/refresh-weekly.mjs` wrote them into `data/weekly/2026-w36.json`, and the
build test refused the page, so nothing was published that afternoon.
`loadWeekly()` now normalises the automatic half the way `loadEditions()` does
the pieces, and both tools normalise before writing. A test covers it.

**Cropped pictures cost megabytes.** The first v1.10 PDF was 10.2MB, larger
than before the 1400px cap. `pdfimages -list` showed why: the three pictures
printed with `object-fit: cover` were stored as uncompressed bitmaps (2.6MB for
one), because Chromium rasterises a cover-cropped image rather than embedding
the JPEG. On paper the grid now crops by clipping a fixed-height box, and the
JPEG passes through whole. Check any future picture rule against
`pdfimages -list` on the live PDF: `jpeg` in the `enc` column is what you want.

### How to look at the print layout without deploying

```sh
pnpm run build
python3 -m http.server 4174 --directory dist &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --no-pdf-header-footer --timeout=20000 \
  --host-resolver-rules='MAP * ~NOTFOUND, EXCLUDE localhost' \
  --print-to-pdf=out.pdf http://localhost:4174/edition.html
pdftoppm -r 28 -png out.pdf pg      # one thumbnail per page
```

The host-resolver rule is what makes it finish: with YouTube, the ad network
and Google Fonts reachable, headless Chrome sat on the page for minutes. Local
Chrome 152 draws the `@page` margin-box footer itself; the Worker's Chrome 128
does not, and draws its own through Puppeteer instead. Read the thumbnails as a
sheet (PIL will paste them into one image) and look for blank space and
stranded headings before trusting any break rule: several that looked right in
the CSS did nothing, and the padding that mattered was not in the print block
at all.

## Recent Highlights (1-2 September 2026)

- **Automated Google Calendar iCal Fetcher & RRULE Recurrence Expansion**: Built `tools/fetch-calendar.mjs` to fetch the configured community calendar's public iCal feed (`crdixon@gmail.com` until v1.11, now `data/community-calendar.json`) and expand weekly/monthly recurring events for the current edition week. Integrated into `tools/refresh-weekly.mjs`.
- **Compact 1-Page What's On Layout**: Curated What's On section capped at 14 items (2 per day), styled in 2-column print CSS (`columns: 2`, `break-inside: avoid`), guaranteeing the entire section fits on 1 page in print & PDF.
- **Event Submission Form (`/submit-event.html`)**: Added frequency selector (*One-off*, *Weekly*, *Fortnightly*, *Monthly*, *Other*) and recurrence checkboxes (*Only during school term*, *Does not run on public holidays*, *School holidays only*).
- **Back Section Reordering**: Structured flow: Classifieds, What's On This Week, Weekly Weather Forecast, Tide Times, Buses and Transport, ending with 3MGB Wilderness Radio strictly last.
- **Community Contributions**: Published Shirley Dixon's approved submission *Farewell to Barbara (2009)* with photo (`exercise-girls-2009.webp`) and MP3 poetry recital (`audio/farewell-to-barbara.mp3`).
- **Clean Typography & Encoding Protections**: Resolved all double-encoded UTF-8 artifacts (`â€™`, `â€”`, `360Â°`) and verified via automated test suite.
- **Version Rollover**: Updated `tools/update-version.mjs` to support version rollover past `.99` (`v1.00`+ through `v1.08`).

---

## Two things settled after this was first written

**Submitted listings now publish themselves.** A push carrying
`data/directory/**` or `data/editions/**` deploys production; anything else
still needs a deliberate `workflow_dispatch`. The site told people "live in
about two minutes" while production waited on a maintainer, which reads as a
failure and gets retried.

**The Worker can now see listings added through the form.** It only had the five
bundled JSON files, so a listing submitted through the site could not be
claimed, could not have an event attached, and did not register as a duplicate —
the directory was one-way. `findEntity()` falls back to `data/directory/<slug>
.json` in the deployed assets.

## The one thing to do first

**Save the listing once from the manage link.** `data/directory/colin-dixon.json`
still holds `verifiedAt: null`, because it was written before the code that
records the verification a claim proves. Until it is re-saved the listing reads
"Not yet verified" and offers Claim instead of Edit — both correct given the
data, both wrong given what actually happened. One save rewrites the file and
fixes both, and it will deploy itself.

1. https://lovemallacoota.au/add-listing.html — fill it in with any address
2. The code arrives from `Love Mallacoota <coota@oze.com.au>`
3. **Follow the link in the email**, do not type the address — the `?id=` matters
4. Enter the code, save

Watch it happen:

```sh
npx wrangler tail --env="" --format json
```

If it stops, [`docs/EMAIL.md`](EMAIL.md) has a table mapping every log line to
its cause.

---

## What changed on the 31st

### The mail chain, which had never worked

Verification codes now go to the person who typed the address, through Resend
(`src/mailer.ts`). Messages that belong to Colin still go through the adnet
relay, which is what it is for. Two paths, because the relay deliberately cannot
choose a recipient and Cloudflare Email Routing cannot reach a stranger.

Five faults found and fixed, none of which produced a failing build or an error
anybody would see:

1. **CSP `connect-src` had no `challenges.cloudflare.com`** — Turnstile loaded,
   built its container, and died on the call that starts the challenge. No
   iframe, no token, no error. This was underneath the other four, so fixing the
   secrets first was correct and still looked like no progress.
2. **The honeypot was called `website`**, beside a real `website_url` field. A
   password manager filled it and the submission was discarded as a bot while
   the page said "Check your email for a code".
3. **`RELAY_KEY` was an empty string** on `adnet-serve`. It lists identically to
   a correct one.
4. **`TURNSTILE_SECRET_KEY` came from a different widget** than the site key.
5. **The Email Routing destination was verified on the wrong account** — there
   are four on one login and two are named `Colin@oze.com.au` and
   `Col@oze.com.au`.

And a sixth, found while testing the fix:

6. **`/verify.html?id=…` posted no id.** The page read `Astro.url.searchParams`
   in the frontmatter, and this is a static build, so it shipped `value=""` on
   every copy. The server then blamed the code the person had just typed
   correctly. Confirming a listing had never been possible.

### 3MGB's weekly programme

[This Week](https://lovemallacoota.au/edition.html) now carries the radio
programme: 22 local shows across the seven days, from Radio Waves 2026 V6.
Standing data in `data/radio-program.json`, like the bus timetable — read at
build time, changed when 3MGB publish a new guide, never fetched during a build.

Colin's editorial call: the guide still prints three shows as postponed until
July 2026, July has passed, and they are shown as running. The reason is in the
data file; restoring the `postponed` key puts the strike-through back.

### Tooling that came out of it

- **[`tools/push-secrets.sh`](../tools/push-secrets.sh)** — verifies every secret
  against the service that owns it and refuses to send one that fails. This is
  the direct answer to Worker secrets being write-only.
- **Diagnostic logging** — Turnstile's `error-codes`, a missing token as distinct
  from a rejected one, the relay's status and body, Resend's refusal. Every one
  of these replaced a silent failure.
- **Tests** that guard the classes of bug found: CSP third parties, honeypot
  naming, label targets, build-time query reads, codes addressed to the
  submitter.

---

## Open question — multiple types on one listing

Colin asked to "add more Types, eg Business to Service" and did not pick between
the readings. Three possibilities, in ascending order of work:

1. **Change the one type** — already works. The manage page has a "What this is"
   selector as of v0.75; changing it moves the listing to the matching section.
   Try this first; it may be all that was meant.
2. **More types in the list** — the eleven offered may not describe every kind of
   Mallacoota business. Cheap to extend once somebody names the gaps.
3. **One listing in several sections** — a listing appearing under both Services
   and Eat & Drink. This is a data-model change: `section` is a single value and
   drives the directory pages, the counts, the tag filters, the CollectionPage
   schema and the breadcrumbs. Do not start it without deciding it is wanted.

Worth knowing before choosing: `categories` is **already** a list, and shows as
chips on the listing. If the want is "describe my listing several ways" rather
than "appear in two sections", letting owners edit their categories from the
manage page is a much smaller change that may cover it.

## Still open

| | |
| --- | --- |
| ~~Finish a submission end to end~~ | **Done, 31 Aug.** `colin-dixon` went add → code → verify → commit → live. First complete submission in the site's history. |
| **`STRIPE_WEBHOOK_SECRET` not in `.env.secrets`** | It is set in production and working; the local record is incomplete. Add it when convenient. |
| **Rotate two credentials** | An 84-character and a 390-character string went through the shell and out to Cloudflare's siteverify during debugging, and one spent time in the Worker as `TURNSTILE_SECRET_KEY`. If either was a GitHub or Cloudflare token, reissue it. |
| **`allowed_destination_addresses` on the relay** | `serve/wrangler.jsonc` in the adnet repo. Would make a wrong destination fail at deploy rather than at send. |
| **Community calendar not yet created** | The personal calendar is out of the page and out of the weekly fetcher as of v1.11; `data/community-calendar.json` is empty, so What's On shows the regular meetings and an "add an event" panel instead of an embed. Colin creates a Google Calendar for the town, makes it public, and pastes its `@group.calendar.google.com` id into `calendarId`. The build refuses a consumer mail address. |
| **No listing has a photograph** | `images/listings/` is empty. The biggest lever on how the site feels to someone arriving from Facebook. |
| **Promotion** | The blockers are the calendar above and the photographs. This Week is the strongest thing to lead with; `docs/outreach/promotional-material.md` has the copy. |

---

## Letters written, none sent

- [`docs/outreach/letter-to-the-college-and-society.md`](outreach/letter-to-the-college-and-society.md)
  — archive permission, printed copies, contributing to This Week, and whether
  the edition could carry the Mouth's name. Addressed to the Principal by role;
  the office would not give the name.
- [`docs/outreach/letter-to-3mgb.md`](outreach/letter-to-3mgb.md) — unsent.
  Nobody at 3MGB has been contacted about the programme now on the site.

---

## Where things are

| | |
| --- | --- |
| Deploy | `gh workflow run deploy.yml -f target=production`. **Never `pnpm run deploy` locally** — it builds without the Turnstile site key from GitHub secrets and ships the always-passes test key. |
| Secrets | `./tools/push-secrets.sh`, from `.env.secrets` (gitignored). |
| Mail | [`docs/EMAIL.md`](EMAIL.md). |
| Release checks | [`docs/DEPLOYMENT.md`](DEPLOYMENT.md). |
| Accounts | Four Cloudflare accounts on one login. `adnet-serve` on `1b494ec3…`, `lovemallacoota` on `ab29454d…`. See EMAIL.md. |
