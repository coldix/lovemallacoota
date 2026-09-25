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

## Reading on screen (v26.09.001, 25/09/2026 04:00 AM AEST)

Readers found the page clunky on phones, so the edition and its story pages
now have a plain reading layout on screen. Print and the PDF are unchanged
apart from the points marked below.

- **Plain paper, no glass.** No photograph, blur, shimmer or fade-in behind
  the text. Light and dark themes both work.
- **One column on screen**, about 68 characters wide, in slightly larger type.
  Two columns are for print only.
- **Contents first.** Short heading, then the PDF, Print and Past editions
  buttons, then "New this week", then the contents. The cover photograph
  follows the contents on screen. The survey banner sits below the stories on
  edition pages.
- **Always a way back.** A "Contents" button stays at the bottom right, and
  each section ends with "Back to contents".
- **A page for each story** at `/edition/<issue>/<story-id>.html`, with
  Previous, Contents and Next links. Easier on a phone, and a story can be
  shared by its own link (with its own photo on Facebook). The whole issue
  stays at `/edition/<issue>.html` and is what prints and becomes the PDF.
  The story markup lives in `src/components/EditionArticle.astro`, so the
  two can't drift apart.
- **Print:** "New this week" and the on-screen links no longer print.
  `PDF_LAYOUT` is bumped to 4, so cached PDFs are rendered again.

## Photographs on held stories (v26.09.001)

A guest's photograph is staged in `uploads/` when the story is sent, but the
story only reaches `data/editions/` when it is approved. `uploads.yml` now also
runs on edition changes, so approving a story converts its photographs.
Second and third photographs (`<id>-2`, `<id>-3`) attach to the story's
`images`. Photographs are rotated using the camera's orientation tag, so phone
photos no longer come out sideways.

## Fuller printed pages (v26.09.002, 25/09/2026 04:45 AM AEST)

- Story columns are balanced, so a story that ends mid-page splits evenly
  across both columns. Filling the left column first left the right one half
  empty, and the next story could not start in that gap.
- Tides, buses, radio and What's On may break between days or services. Kept
  whole, each jumped to a fresh page (the weather page was 60% empty).
- The closing photograph is capped at 85mm so the closing line isn't left
  alone on the last page.
- September went from 28 pages to 25; the week 36 archive from 19 to 18.
  `PDF_LAYOUT` is 5.

## Crossword placement in print (v26.09.004, 25/09/2026 09:00 AM AEST)

The crossword needs a page to itself. Wherever it fell mid-issue it jumped to
the next page and left most of the page before it empty (75% in September).
On paper it now follows the contents, which already ends a page, so it takes
page 3 with no gap. This is print-only CSS (`order` on a flex `main`); the
screen order and the contents list are unchanged. `PDF_LAYOUT` is 6.
