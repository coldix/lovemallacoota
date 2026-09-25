# MISSION — Add 3MGB’s weekly program to This Week in Mallacoota

**Repository:** `coldix/lovemallacoota`
**Local path:** `/Users/dixon/web/lovemallacoota`
**Site:** https://lovemallacoota.au
**Edition:** https://lovemallacoota.au/edition.html
**Date:** 31/08/2026

Paste this whole file into the session that is already building Love Mallacoota.

## Your mission

Add **3MGB Wilderness Radio’s weekly program** as a standing automatic section of *This Week in Mallacoota*, the same way buses already work: committed data, rendered at build time, present every week until the data file is edited.

Do not fetch the program live during the build. Do not type it into a single edition JSON. Do not invent a week-by-week rundown. Their published guide is a standing Monday–Sunday grid.

## Source (checked 31 Aug 2026)

- Program page: https://www.3mgb.org.au/program/
- PDF: https://www.3mgb.org.au/wp-content/uploads/2026/05/radio-waves-master-program_2026_v6-bf629ac48e89.pdf
- Title in the wild: **Radio Waves 2026 V6**. Filename is V6; the Word title inside still says V5. Use V6. Author of the PDF is Simon Walshe; do not name him as station manager.
- Page last modified **26 May 2026**.
- Frequencies: **101.7 FM Mallacoota**, **96.9 FM Genoa**.
- Studio: 66 Maurice Ave. Phone (03) 5158 0929. SMS 0482 170 909. Email cootafm@gmail.com.
- Listen: 3mgb.org.au, Community Radio Plus, iHeart.
- Their own header: volunteer presenters, subject to change at short notice.

Transcribe the local shows from that PDF. Do not scrape a different year, do not “improve” names, do not drop a slot because it looks like a network feed unless the PDF already marks it that way.

## Week

This Week uses ISO weeks. Edition 26:36 is Monday 31 August – Sunday 6 September 2026. 3MGB’s grid is also Monday–Sunday. Treat them as the **same week**. If a show is listed for Friday, it belongs in that Friday of the edition week.

## Pattern to follow

Read `docs/WEEKLY-MOUTH.md` (W5: automatic sections are generated, not typed) and how **Buses and Transport** is done:

- Standing file: `data/bus-timetable.json`
- Wired in `src/lib/editions.mjs` (`SECTIONS` + `editionSections`)
- Rendered in `src/components/EditionBody.astro` (`section.auto.type === "timetable"`)
- PDF is rendered from the edition HTML, so a web section is a print section. No separate PDF layout.

Radio is the same class of data as the bus timetable (rarely changes; edit the file) and **not** the same class as weather (regenerated each week by `tools/refresh-weekly.mjs`).

Collaborator notes, not a spec: `docs/outreach/3mgb.md`. Outreach letter exists at `docs/outreach/letter-to-3mgb.md` and has **not been sent**. Do not email 3MGB. Do not add Mouth-archive asks to this work.

## What to build

1. **Data file** e.g. `data/radio-program.json` with source, source URL, version (V6), fetched/checked date, frequencies, listen links, and the Monday–Sunday grid (time, show name, presenter as printed). Mark postponed shows in the data, do not silently omit them.

2. **Section in This Week.** A heading people will recognise — **3MGB Wilderness Radio** or **On the Radio** is better than stuffing it under Buses. Place it next to transport (after buses is fine). It should appear in the edition TOC.

3. **Layout.** A readable day-by-day grid (not a bus from/to table). It has to print. Keep it compact enough for the PDF: local shows are the point, not a wall of CRN filler if the PDF distinguishes them. If the PDF mixes local and network, show the local slots clearly and summarise network/fillers rather than listing every hour of satellite if that would make the section unreadable. Prefer the PDF’s own structure over a clever redesign.

4. **Source line** under the grid, in the same voice as the bus source line. Something in this shape: program from Radio Waves 2026 V6 on 3mgb.org.au/program; volunteer presenters; can change at short notice; 101.7 / 96.9; listen live. Link their program page, not a copy of the PDF in our repo.

5. **Stale postponements.** Three shows are still printed as **postponed until July 2026** and it is now 31 August:

   - *The Open Page* — Don and Kate, Friday 11.00
   - *Folk Like Us* — Don Ashby, Friday 12.30
   - *Good Morning Blues* — Greg Hopkins, Saturday 7.00

   Print them as postponed, with that wording, until 3MGB send a new guide. Do not guess that they are back. A short note that the published guide is V6 (May) is enough; do not scold the station in the edition.

6. **Directory.** If 3MGB is not already a community/media listing, add a normal directory listing from `docs/outreach/3mgb.md` contacts. That is secondary to the weekly section.

## Constraints

- Do not contact 3MGB from this mission.
- Do not scrape or cache their audio.
- Do not claim we are their official program, or that donations to them are tax-deductible (ABR: not DGR).
- Do not address or name a president; the public site has no current committee list. Do not use Mike Amos.
- Do not mix Holiday Mouth (their old fundraising mag) with *The Mallacoota Mouth*.
- Match existing edition CSS; do not invent a new visual language.
- Empty automatic sections are omitted; this one should not be empty once the data file exists.

## Done when

- Current edition at `/edition.html` shows the 3MGB program for the same Monday–Sunday week.
- Past editions keep whatever grid was in the data file at the time they were built (standing file is fine; no need to snapshot per week unless that falls out of the existing pattern for free).
- The printable PDF includes the section because it is in the HTML.
- Source, version, frequencies, listen link, and the three July postponements are visible and accurate to V6.
- A reader can tell this is 3MGB’s guide, not ours.

If a cleaner layout than a day grid would print better, use it. The intent is: every week, the town can see what is on 101.7 / 96.9 without leaving This Week.
