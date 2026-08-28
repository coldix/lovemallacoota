# The weekly Mouth

A weekly community edition on lovemallacoota.au: contributed articles under the
headings the Mouth actually used, automatic sections for the things nobody
should have to type in, and an end-of-week freeze that produces a printable PDF
with a table of contents.

This document is the design. It records what was decided, what follows from
each decision, and what is deliberately left until later.


## Decisions

**W1. Contributors sign in through Cloudflare Access.** An email allow-list in
Zero Trust, sign-in by Google or one-time PIN. The Worker reads the verified
`Cf-Access-Authenticated-User-Email` header and trusts it. No password, session
or token handling of our own, and the same mechanism already guards the adnet
dashboard. Free up to 50 users, which is more contributors than the town is
likely to produce.

**W2. Publishing rebuilds the site.** A submission that passes the check is
committed to the repository, which triggers the existing GitHub Actions build
and deploy. The edition stays fully static, so it costs nothing to serve, is
readable without JavaScript, and is visible to search engines and AI crawlers.
The trade is latency: an article appears about two minutes after it is
submitted, not instantly, and each publish burns a CI run.

*Consequence:* **git is the datastore.** There is no D1 in this account and this
design does not add one. Articles are JSON files under `data/editions/`, so
every edition has a full history, corrections are visible as commits, and the
whole archive can be handed to someone else with the repository.

**W3. The AI check gates publication; approved contributors are not queued.**
A submission from an allow-listed address is checked against the editorial
policy. Pass and it publishes. Flag and it is held and emailed to Colin with the
reason. This follows the mission's own evidence: @mallacootanow needs less than
one moderation action a month across thousands of users, so a review queue would
be a daily obligation guarding almost nothing — and the mission warns that a
daily obligation is what kills the project.

*What the check is for:* personal attacks, unverified allegations about named
people or businesses, material that places someone at risk, political
campaigning, and anything claiming emergency authority. These come from
[`editorial-policy.astro`](../src/pages/editorial-policy.astro), and the check
must quote the clause it is relying on when it holds something.

*What the check is not:* a fact checker, a style editor, or a substitute for the
publisher's responsibility. Colin remains the publisher of everything that goes
live, including anything the check passes.

**W4. The PDF is rendered from the edition's own HTML.** Cloudflare Browser
Rendering turns the published edition page into the PDF, so print and web cannot
drift apart and the table of contents is built from the same headings. Requires
Workers Paid on this account.

**W5. Automatic sections are generated, not typed.** The forecast, the week's
events, a trail and a business are generated into `data/weekly/<week>.json` by
`tools/refresh-weekly.mjs`, committed, and read at build time. Generating into a
committed file rather than fetching during the build means the build never
depends on a third party being up, and a past edition keeps the forecast it was
actually published with instead of silently acquiring today's.

**W6. Tide times are linked, not republished.** The Mouth printed tides taken at
Gabo Island. There is no free, authoritative Australian tide source we may
republish, and a wrong tide time at the Bastion Point bar is the kind of error
that puts someone in the water. The section links to the Bureau of Meteorology
instead. If licensed tide data is ever obtained, this decision changes first.

**W7. The weekly trail and business rotate, and say so.** One trail from
TrailBound within about two hours of Mallacoota, and one business from the
directory, chosen by turn so every one is featured before any repeats. Both
carry a line saying which number of how many they are, and the business says it
is not paid placement — because the moment a reader suspects it is, every other
listing looks bought too.

Two hours is measured as 70 km in a straight line, which on these roads — out
to the highway at Genoa and back in — is about two hours' driving. That gives
23 trails, roughly six months of weeks. Cape Conran, at 93 km direct and nearer
two and a half hours, falls outside on purpose. The radius lives in
`tools/sync-trails.mjs` and can be widened when the rotation runs dry.


## Sections

Taken from the recurring headings in the 37 catalogued issues, not invented:

| Section | Source | Who |
| --- | --- | --- |
| Editorial | Written | Colin |
| Weekly Weather Forecast | Automatic | Open-Meteo, build time |
| Tide Times | Automatic | Gabo Island, as the Mouth used |
| Mouth Diary / What's On | Automatic | `data/events.json`, the week ahead |
| MADRA News | Submitted | MADRA |
| Out and About at MP-12 | Submitted | The college |
| Community | Submitted | Any approved contributor |
| Public Notices | Submitted | Any approved contributor |
| Positions Vacant | Submitted | Any approved contributor |
| Church Times | Recurring data | Rarely changes; edit the data file |
| Sport | Submitted | Clubs |
| Kids' Space | Submitted | The college and families |

Sections with no content in a given week do not appear, in the edition or the
PDF.


## Data model

```text
data/
  editions/
    2026-w35.json        # one edition: metadata, section order, articles
  events.json            # the calendar, feeding Mouth Diary (see NEXTSTEPS F11)
  church-times.json      # recurring, hand-edited
  contributors.json      # allow-list: email, display name, sections, active
```

An edition moves through three states: `open` (the current week, accepting
submissions), `frozen` (the week has closed, no further articles), and
`published` (frozen, with a PDF rendered and linked). Only one edition is
`open` at a time.

Each article records its author's verified email, the section, the submitted
time, the published time, and the AI check's verdict and reasoning, so a
contested decision can be reconstructed later.


## Flow

```text
Contributor  →  /submit  (Cloudflare Access)
                  ↓ verified email
              Worker: is this address on the allow-list?
                  ↓ yes
              AI check against the editorial policy
                  ↓ pass                         ↓ flag
              commit to data/editions/<week>   hold + email Colin, quoting
                  ↓                              the clause and the passage
              GitHub Actions build + deploy
                  ↓ ~2 minutes
              live in this week's edition

Sunday 23:00 AEST  →  cron (.github/workflows/roll.yml)
              freeze the open edition whose last day has arrived,
              open the following week empty, generate its forecast
              and features, stamp a release, deploy, and warm the
              closed edition's PDF so the first reader does not wait
```


## Build slices

1. **The edition page.** Static rendering of an edition from JSON, the section
   order above, the archive of past editions, a nav entry. No submissions yet —
   articles are added by editing the file. This proves the shape before any
   moving parts exist.
2. **Automatic sections.** Weather and tides at build time, Mouth Diary from
   `events.json`. This also starts moving the calendar off the personal Google
   account, which NEXTSTEPS F11 wants anyway.
3. **Submissions.** Cloudflare Access, the allow-list, the submit form, the
   commit-to-repo path. Publishing still gated by the check in slice 4, so until
   then submissions land as held.
4. **The AI check.** Policy prompt, verdict recording, hold-and-notify by the
   adnet relay, and an appeal route that is a human reading it.
5. ~~**Freeze and PDF.**~~ **Done.** `/edition/<week>.pdf` renders on demand
   through Browser Rendering, so no storage was needed and the PDF cannot drift
   from the page. `tools/roll-edition.mjs` closes the week and opens the next,
   run by the Sunday 23:00 AEST cron in `.github/workflows/roll.yml`. It is
   idempotent — a missed Sunday recovers on Monday, and running it twice does
   nothing the first run did not. Emailing an edition is not built and waits on
   the relay.
6. **Email digest.** Only once several editions exist and there is something
   worth sending. An empty digest on a schedule does more damage than none.


## Open questions

- **The name.** *The Mallacoota Mouth* is not ours to reuse. Until the rights
  question in [`ARCHIVE.md`](ARCHIVE.md) is settled, this is "the weekly
  edition" in code and needs a name of its own before launch. Reusing the title
  of a masthead we are simultaneously asking permission to archive is the sort
  of thing that sours a permission conversation.
- **Which model runs the check**, and what it costs per submission at, say,
  twenty articles a week.
- **Corrections.** A published article that turns out to be wrong needs a
  visible correction, not a silent edit, per
  [`corrections.astro`](../src/pages/corrections.astro).
- **Contributor onboarding.** Who adds an address to the allow-list, and what
  the contributor is told about the licence their words are published under.
