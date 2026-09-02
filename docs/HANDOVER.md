# Handover — 2 September 2026

Live release **v1.08** at [lovemallacoota.au](https://lovemallacoota.au).
Working tree clean, `main` pushed, 125 tests passing.

---

## Recent Highlights (1–2 September 2026)

- **Automated Google Calendar iCal Fetcher & RRULE Recurrence Expansion**: Built `tools/fetch-calendar.mjs` to fetch `crdixon@gmail.com` public iCal feed and expand weekly/monthly recurring events for the current edition week. Integrated into `tools/refresh-weekly.mjs`.
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
| **Dead `entity` branches on claim / submit-event** | The build-time lookup was always null, so the branch telling a claimant "we will email the published address" has never rendered. Resolving the listing client-side would make that page considerably better. |
| **Dead `.survey-*` CSS** | ~12 lines with no markup rendering them. Flagged as a background task. |
| **Personal calendar behind What's On** | `/calendar.html` embeds `crdixon@gmail.com`, whose full history is publicly downloadable — it contains a doctor's appointment and two named birthday parties. Move the community events to a dedicated calendar before promoting the page. |
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
