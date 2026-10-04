# Coota plan: puzzles, Next Month, weekly extract

A monthly Coota is the book of the month. A weekly is a slice cut from it on
Sunday/Monday: forecast, tides, What's On this week, Business of the Week.
Crosswords and puzzles stay in the monthly. Sun, moon and month-shaped events
stay in the monthly.

This is the plan, not the live behaviour. Do not implement until this file
says to. Do not turn the old Sunday week-roll (open an empty week) back on:
the new Sunday/Monday job *extracts* a weekly from the open month.


## Decisions already taken

**Still this month: yes.** While 26:09 is open, a list of remaining September
monthly events sits above Next Month. It comes off the frozen PDF.

**No forecast, tides or weather on the monthly.** None of the three. They
belong on the weekly extract and on What's On.

**Coota September 2026 includes last week's articles.** The 15 pieces in
Edition 26:36 are copied into `data/editions/2026-09.json`. The weekly archive
keeps its own copies. `publishedAt` stays as it was, so they sit in the month
body, not under New this week.

**Business of the Week goes with the weekly extract**, not on Coota.


## How a month and a week relate

```text
All month     Coota 26:09 is open. Stories append. People read the growing
              month. No weekly forecast, tides, weather or Business of the
              Week on this page.

Sunday/Monday A weekly is extracted from the open month: the stories whose
              publishedAt falls in the ISO week just gone (or current —
              same rule as New this week), plus What's On this week,
              seven-day forecast, tides, Business of the Week.
              Permanent page /edition/2026-wNN.html and a PDF.

1 Oct         26:09 freezes. Monthly PDF. 26:10 opens. Crossword solution
              for No. 2 moves onto 26:10.
```

Week 36 already exists and stays the first weekly archive. From week 37
onward, weeklies are extracts, not a second place to submit. Contributors
still submit to the open monthly.

Trail of the Week and Video of the Week are the same shape as Business of
the Week: they go on the extract, not on Coota, unless you say otherwise.
Radio and the coach timetable are standing reference and stay on Coota.


## Sections

**C1. A section is monthly-only, weekly-only, or both.**

`SECTIONS` gains `editions: "monthly" | "weekly" | "both"`. Empty headings
still drop. The submit form only offers writable sections the open monthly
accepts.

| Section | Where |
| --- | --- |
| Contributed Mouth headings | both (stories live on the month; the extract reprints that week's) |
| Crosswords and Puzzles | monthly only |
| Still this month / Next Month (events, sunrise, sunset, moon) | monthly only |
| What's On This Week, Weekly Weather, Tide Times, Business of the Week | weekly only |
| Trail of the Week, Video of the Week | weekly only (same as business) |
| Radio, buses | monthly (standing). Weekly extract may repeat them. |

**C2. Crosswords and Puzzles is monthly-only.** Rename The Coota Crossword.
This issue's puzzle, last issue's solution, later puzzles. Not on 26:36 or
any later weekly. Editor-placed, not a submit target.

**C3. Monthly does not print weekly What's On, weather, forecast or tides.**

**C4. Still this month, then Next Month.**

- **Still this month** (open issues only): remaining dated and monthly
  events in the issue's own calendar month.
- **Next Month**: the following calendar month. For 26:09 that is October.
  Events first, then a day-by-day sunrise, sunset and moon table.

No tide column. Spring/neap as a moon note is enough. Season notes (whale
migration, equinox) print once, not on every row.

**C5. Sun, moon and monthly events come from the oze almanac, not from
recomputing them here.** See the calendar recommendation below.


## Calendar: look, then recommend (do not switch yet)

Looked at [calendar.oze.net.au/embed/calendar](https://calendar.oze.net.au/embed/calendar)
on 7 September 2026. It is already a Mallacoota **monthly** almanac: community
events, Vic terms and public holidays, lunar phases, sunrise and sunset,
marine season notes. It says so on the page: "Monthly events, Vic terms &
natural cycles (no weekly routine clutter)." The embed dialog already names
Love Mallacoota as a user.

It is not a Google Agenda dump of every weekly club meeting. That is the
point.

### What it already offers

| Piece | URL / field | Use |
| --- | --- | --- |
| Interactive agenda (iframe) | `https://calendar.oze.net.au/embed/calendar?view=agenda` | What's On page, for people |
| A4 landscape grid iframe | `https://calendar.oze.net.au/embed/grid?orientation=landscape` | Print / hall wall, not the edition |
| A4 portrait grid iframe | `https://calendar.oze.net.au/embed/grid?orientation=portrait` | Same |
| Month-ahead widget iframe | `https://calendar.oze.net.au/embed/month-ahead` | A visual Next Month; not the PDF source |
| JSON API (CORS) | `https://calendar.oze.net.au/api/v1/almanac.json?month=YYYY-MM` | **Coota's source of truth** |

September 2026 JSON (`status: success`) includes:

- `communityEvents` — 20 dated items, already month-shaped. Sources mixed:
  Mallacoota Community Calendar, MDHSS, Victorian Department of Education,
  Victorian Public Holidays. Categories: community, market, meeting,
  school_term, arts, holiday.
- `dailySchedule` — all 30 days, each with `solar.sunrise`, `solar.sunset`,
  `daylightDuration`, that day's events, seasonal highlights.
- `moonPhases` — last quarter, new, first quarter, full, with AEST times.
- `solarBenchmarks` — e.g. spring equinox 20 September.
- `marineSeasonalNotations` — whale migration as a season, not 30 rows.
- `location` — Mallacoota 37.55°S, 149.75°E, Australia/Melbourne.

Event ids look like Google Calendar ids, so the almanac is already
aggregating the community calendar and MDHSS, then adding sky and terms.

### Recommendation

**1. Coota (monthly) reads the JSON API, committed.** Daily job fetches
`almanac.json?month=` for the open month and the next month, writes
`data/weekly/2026-09.json` (or a sibling `data/almanac/`). Build and PDF
never depend on the network. Same rule as today's forecast file. Still this
month and Next Month are slices of that snapshot. Sunrise, sunset and moon
come from `dailySchedule` and `moonPhases`. Do not add `sun.mjs` unless the
API is down; do not keep fetching Google iCal for the monthly.

Do **not** iframe the almanac into `edition.html`. An iframe is not in the
PDF, and a frozen month must not change when the live calendar does.

**2. What's On (`/calendar.html`) embeds the agenda iframe** in place of
the Google Calendar embed. That is the human view of the same almanac.
Keep the MDHSS partner frame only if the almanac's MDHSS-sourced events are
not enough on the page; the JSON already includes them, so a second MDHSS
iframe is probably duplicate. Leave the seven-day weather and the Gabo tide
link on What's On: those are weekly tools, and Coota will not carry them.

**3. The weekly extract still needs a seven-day diary.** The almanac
deliberately omits weekly routine clutter. Club meetings that run every
Tuesday will not appear. For What's On This Week on the extract, keep
`coming.json` from the Google community calendar iCal (today's
`fetch-calendar.mjs`) *or* from directory `meetingTimes`, until the almanac
grows a weekly feed. Do not pretend the monthly JSON is a week diary.

**4. Do not treat the iframe as a data source.** Use JSON for anything we
print. Use the iframe only where a person is looking at a screen.

### Watch-outs (data, not blockers)

- Some titles are thin ("Dyson and long") or timed at midnight (Book Club
  12:00 am). Print what the feed sends; fix upstream.
- Seasonal highlights repeat every day in `dailySchedule`. Print the
  `marineSeasonalNotations` block once, not 30 lines of whales.
- "Spring tides peak" is a moon/season note, not licensed tide heights.
  W6 still holds: no tide table on Coota; weekly extract links Gabo / BoM.
- September's event list included a 1 October shopping bus. Filter Next
  Month / Still this month by calendar month, do not trust `totalEvents`.

### What not to do

- Do not point `data/community-calendar.json` at a personal gmail. The
  almanac is not a Google id; it is our own host. The personal-calendar
  guard stays for any remaining Google embeds (MDHSS).
- Do not live-fetch the JSON at Astro build time.
- Do not switch production until a snapshot has been committed and the
  monthly HTML is tested against it.


## Weekly extract (Sunday/Monday)

A new job, not `roll-edition.mjs` as it stands (that opened empty weeks).

On the first run of the week (Monday Melbourne, with Sunday-night recovery):

1. Freeze nothing on the monthly.
2. Write `data/editions/2026-wNN.json` as `kind: weekly`, `status: frozen`,
   `articles` = copies of monthly stories whose `publishedAt` falls in that
   ISO week. Empty week is allowed (cover, diary, forecast, business still
   print).
3. Attach automatic weekly sections from `coming.json` and the current
   rotation: What's On This Week, seven-day forecast, tides (link + moon),
   Business of the Week, trail, video.
4. Warm `/edition/2026-wNN.pdf`.

Idempotent: running twice the same week rewrites the same frozen weekly
from the monthly, so a story that landed late Sunday still makes the
extract on Monday. After Monday, that weekly file is frozen for real and
later stories wait for the next extract.

26:36 is already that shape (frozen weekly, 15 stories). It is not rebuilt
from 26:09; it is the source we copy *into* 26:09.


## What the pages look like

**Coota 26:09 (open)**

- All contributed pieces, including the 15 from week 36
- New this week (current ISO week only; empty until a new September story)
- Crosswords and Puzzles (No. 2; solution held for 26:10)
- Still this month (remaining September monthly events)
- Next Month (October events, then October rise / set / moon)
- Radio, buses
- No forecast, no weather, no tides, no Business of the Week

**Weekly extract (e.g. 26:37)**

- That week's stories only
- What's On This Week, forecast, tides, Business of the Week, trail, video
- No crossword, no Next Month, no sun/moon month table

**`/calendar.html`** (when we switch, not before)

- oze agenda iframe
- seven-day forecast and tide link stay
- MDHSS frame only if still needed


## Code that has to change (when we build this)

- `src/lib/editions.mjs` — flags; monthly autoFeed; copy-from-weekly helper
- `tools/refresh-weekly.mjs` — fetch almanac JSON into the monthly snapshot;
  keep `coming.json` for the seven-day calendar and the extract
- `tools/roll-week-extract.mjs` (new) — Sunday/Monday extract; `month.yml`
  stays month-end; a dispatch-only extract workflow first
- `src/components/EditionBody.astro` — Still this month, Next Month,
  sun/moon table; hide weekly-only sections on monthlies
- `src/pages/calendar.astro` — later, swap Google iframe for oze agenda
- `data/editions/2026-09.json` — receive the 15 week-36 articles
- Tests as in the previous draft, plus: 26:09 contains week-36 headlines;
  monthly HTML has no Tide Times / Weekly Weather / Business of the Week;
  extract HTML does


## Out of scope until this plan is built

- Implementing any of the above
- A crossword generator
- Licensed tide heights
- Old Sunday job that opened an empty week
- Switching `/calendar.html` live before a committed almanac snapshot exists
