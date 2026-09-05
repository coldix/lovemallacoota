# Handover — 5 September 2026

Live release **v1.71** at [lovemallacoota.au](https://lovemallacoota.au).
142 tests passing. Seventeen releases today, v1.54 to v1.71.

The previous handover, written 4 September, is in the git history at
`docs/HANDOVER.md` before this commit. Its one urgent item — the live site
serving Cloudflare's always-passes Turnstile test key — **is fixed**. Every
deploy since has come out of GitHub, and the four forms carry the real site key
`0x4AAAAAAE…`. **The unverified half is now verified too** — see the form test
below. Nothing from that warning is still outstanding.

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
today while the scheduled weekly job held the branch, and the deploy fired
anyway — it went out green, from origin, without the commit. The workflow says
"success" because it deployed *something*. Read the run's `headSha`.

---

## The add-listing form was tested end to end, and passed

Asked for by the two previous handovers and finally done on the evening of 5
September, with `wrangler tail` running throughout. Every step, in order:

| Step | Result |
| --- | --- |
| `POST /api/listing` | 200, no logs, no exceptions |
| Email delivered | the verify link was opened |
| `POST /api/listing/verify` | code accepted |
| GitHub write | commit `ad02a56`, `data/directory/bridge-cards-club.json` |
| `GET /api/listing/manage?token=…` | 200, the owner's link works |
| Auto-publish | fired on its own and deployed |

**Zero error lines in the whole Worker stream.** So Turnstile, D1, the mail relay
and the GitHub token are all good, and — the specific thing two handovers asked
about — **a real token minted by the live site key was accepted by the secret in
the Worker.** They are a matching pair. Genuine people are not being rejected.

Two things learned in the doing:

- **`./tools/push-secrets.sh --check` proves less than it looks.** It confirms a
  secret is a real, valid Turnstile secret; it cannot tell you the secret belongs
  to the site key on the page. Only a real submission does that.
- **An agent cannot run this test.** Turnstile issues no token to an automated
  browser — correctly — so the widget never produces one and the form cannot be
  submitted. The three minutes have to be a person's. Watching `wrangler tail`
  while they click is the right division of labour.

The listing it produced is real and stayed: the Bridge Club, which had folded, is
now listed as closed with an offer to restart it if three players turn up.

---

## The big change: What's On is a real calendar now

The community calendar went live at v1.62 after being held back for two days on
purpose. Both reasons for holding it are worth knowing, because they will come
back.

**The Coota calendar** is `db00fe3a…@group.calendar.google.com`, a calendar made
for the purpose, so it needs no exception to the guard in `src/lib/calendar.mjs`
that refuses a consumer mail address. That guard exists because a personal
calendar was embedded here until v1.11, and an embedded calendar is downloadable
in full. It stays exactly as strict.

**MDHSS's own calendar** sits beside it in its own frame under its own name.
Theirs *is* on a gmail address, and the exception is not a bypass: a partner on a
consumer domain must name `publishedAt`, the page where its owner already
publishes it. MDHSS embed it on mallacoota.org.au, so embedding it here exposes
nothing new. No such page, and the build fails.

**The weekly diary now comes from the calendar.** `refresh-weekly.mjs` replaces
the diary with whatever `fetch-calendar.mjs` returns, and `weekly.yml` runs daily
at 15:10 Melbourne and deploys production itself. So:

> **What is in the Coota calendar is what the paper prints.**

That is why shipping it early would have been bad. On 4 September the calendar
held 1,346 events in 2025 and nothing after March 2026: the diary would have gone
from fourteen entries to two, overnight, with nobody pressing anything.

### What was imported

Fifty events, as **recurring entries** rather than rows. The September list held
333 rows for what is really about fifty things, and the 2025 calendar held 1,346
rows for sixty-nine. Set a standing item as a recurring event with no end date
and the calendar maintains itself.

Deliberately left out, and worth keeping out:

- **65 rows that are opening hours** — both op shops, the Tool Library, the
  Bunker. These belong on the listing, not in a calendar.
- **53 rows already on MDHSS's calendar** — verified against their live feed
  rather than trusted from the `(MDHSS)` tag in the title.
- **Seniors Pub Lunch and Seniors Dinner**, which were already recurring in the
  Coota calendar from June 2025, with Nancy's phone number and the prices in
  them. The September rows would have been thinner duplicates.

---

## The 2025 calendar is not evidence

It has now been wrong the same way four times. It contains what somebody found
time to type, not what happens.

| It said | It is |
| --- | --- |
| Market Day, weekly | First Saturday, monthly — the halls committee's own listing says so |
| Morning Melodies, weekly | Monthly |
| EGSC Business Support Officer, 26 weekly entries | Its own description reads "TBC - third Tues Wed of month" |
| Community Op Shop, Fridays | Monday to Friday. The calendar only ever recorded the Friday, so v1.59 published a five-day shop as a one-day shop |

Treat repetition in it as a record of typing, not of frequency. Where its *prose*
says something — "first Wednesday of every month" on Walk & Talk — that is a
different and better kind of evidence.

---

## Two bugs that hid the same way

Both were silent. Nothing errored, nothing failed, the data simply did not arrive.

**Enrichment rows dropped three fields.** `associationToEntity` copies enrichment
across field by field and `notes_seasonal` was not among them, nor `trading` nor
`menu`. Four listings went live with opening hours and without the notes that
qualified them — "the bar opens 4pm", "if the banner is out the front, we're
open". Unqualified hours read as settled fact, which is worse than publishing
neither. Fixed at v1.64, with a test that asserts every field an enrichment row
sets arrives on the listing and counts what it checked so it cannot pass by
matching nothing.

**Trading status rendered on the section pages and nowhere else.** A closed
business said so on `/food.html` and not on its own page — the page a search
sends people to. Lee's Pizza had been closed and for sale since 30 August with
its own page reading "typically open evenings". Fixed at v1.65.

### And two traps still in `associationToEntity`

They did not ship, but they nearly did, twice in one edit:

- The slug falls back to `slugify(commonName)`. Setting `commonName` on the
  Angling Club moved its whole URL to `/listing/the-clubrooms.html`.
- `name` falls back to `commonName` before the legal name. The same edit renamed
  the club to "The Clubrooms".

Naming a *building* renamed and relocated the *organisation* in it. Both are
pinned explicitly on that row now. If you set `commonName` on an association,
set `slug` and `name` too.

---

## What's New in the directory

`/directory-changes.html` is a dated record of everything added, renamed and
changed, and it is **read out of git**, not kept by hand. `tools/build-directory-changes.mjs`
replays every source `loadDirectory()` reads at each commit, runs it through
today's `assembleEntities`, and diffs consecutive states. It runs first in every
build, so the page cannot fall behind what it describes.

Three things it had to get right before it was fit to publish, all of which it
got wrong first:

- **Renames are not deaths.** Nine slugs changed on 29 August and 4 September. A
  naive diff called them all removals, which would have told readers the progress
  association and the tool library had folded. They pair by incorporated-association
  number, by git's own detection of the listing photograph being moved in the same
  commit, or by name.
- **Branches are not history.** Walking every commit replayed states that were
  never live. It follows `--first-parent`.
- **Objects are not compared with `!==`.** `trading` is an object, so Lee's Pizza
  changed its trading status in every commit for a week.

---

## Where the directory stands

128 listings, 53 with a photograph. Do & See went from five listings to ten
today, and the Bridge Club arrived through the form in the evening.

**The Lions Park precinct is now mapped.** Five things stand within a hundred
metres of each other and the directory had two of them: the Mudbrick Hall (the
Muddie), the Angling Club (the Clubrooms), the tennis club, the skate park and
the playground.

That precinct also produced the day's worst mistake. Given a map pin, a sentence
saying the location is called the Mallacoota Sporting Club Rooms, and a second
pin below it, I attached the sentence to the link above rather than the one
below, and published a listing merging two buildings a hundred metres apart. It
stood for about two hours. **When a message carries two links and one sentence,
ask which link the sentence belongs to.**

### Still wanted

- `docs/coordinates-wanted.md`: five listings with no coordinate, sixteen
  unverified. Send the Google map link, not the `@lat,lng` from the address bar
  — the place pin sits later in the link as `!3d…!4d…`.
- Three accommodation listings have no photograph: Eagle View Stay, Lin Cottage,
  MallaMaurice Holiday Units.
- Nothing outstanding on the forms. See below.

---

## Things done to production outside the repository

Two, both recorded here because nothing in git shows them.

**A D1 row was edited by hand.** Fixing the `bega-valley-garage-doos` typo
renamed the listing's file, which broke the manage link its owner was emailed on
3 September — `handleListingManage` resolves the token's `listing_slug` against
`data/directory/<slug>.json`. The token row was repointed at the new slug so the
owner's original link works, and an `audit` row records it. Tokens are stored
hashed, so a "resend" would mean minting a second live token, not resending the
first.

**Fifty-one events were created in the Coota calendar**, and three had their
location corrected afterwards when the Betka Road tennis courts turned out to be
gone. None of this is in git. The calendar is the source of truth for the diary
now, so treat it as production.

---

## Where things are

| Thing | Where |
| --- | --- |
| Deploy | `gh workflow run deploy.yml -f target=production`, never locally |
| Version and README stamp | `pnpm run version:site` writes both; a test fails if they disagree |
| What's New record | `pnpm run changes`, and automatically as the first build step |
| Community calendar id | `data/community-calendar.json`, with partner calendars beside it |
| Listing photographs | `images/listings/<slug>.webp`, alt text keyed by **filename**, not slug |
| Coordinates wanted | `docs/coordinates-wanted.md` |
