# Coota

The monthly community edition on lovemallacoota.au. The first weekly, Edition
26:36 (31 August–6 September 2026), is closed and archived. From September 2026
the live page is **Coota YY:MM**.

See the original weekly design in [`WEEKLY-MOUTH.md`](WEEKLY-MOUTH.md). What
changed:

- The open edition is a calendar month (`data/editions/2026-09.json`).
- Stories are added as they arrive. People read the live page as it grows.
- **New this week** lists pieces whose `publishedAt` falls in the current ISO
  week.
- Weather, tides and What's On on the monthly page are the coming seven days.
- At month-end the issue freezes and a PDF is rendered from the same HTML.
- The crossword for this issue is on the page; last issue's solution appears in
  the next Coota.

Month-end freeze is `node tools/roll-month.mjs` (`pnpm run roll:month`),
dispatched by `.github/workflows/month.yml`. No cron until it has been run by
hand once. Crossword solutions live in `data/crossword/` until the next issue
copies them onto the page.

The Sunday week-roll is off. Do not turn it back on.
