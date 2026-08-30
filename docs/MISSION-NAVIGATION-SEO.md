# Mission: Navigation, SEO and Social Sharing

**Project:** Love Mallacoota  
**Site:** https://lovemallacoota.au/  
**Repository:** https://github.com/coldix/lovemallacoota  
**Status:** Ready for implementation  
**Primary implementer:** Claude  
**Date:** 30/08/2026

## Mission

Make Love Mallacoota easier to understand, navigate, discover in search, and share.

The project has evolved from a visitor directory into a broader community information platform. The navigation should now reflect that reality. **This Week is the main current-information product and should have first-class prominence.** The directory remains important, but its categories should read as parts of one directory rather than six unrelated top-level products.

Use this document as the goal, not a pixel-by-pixel specification. Inspect the existing implementation, preserve what works, and use judgement to make the result cleaner, faster and more coherent on desktop and mobile.

## Desired information architecture

```text
Love Mallacoota
│
├── This Week                  /edition.html
│   ├── Notices
│   ├── Community updates
│   ├── Local stories
│   │   └── Local of the Week
│   ├── Weather
│   ├── Tides & moon
│   ├── What's On highlights
│   ├── Transport
│   ├── Trail of the Week
│   ├── Business of the Week
│   ├── Video / 360
│   └── Previous editions
│
├── What's On                  /calendar.html
│   ├── Calendar
│   └── Submit an event
│
├── Directory                  /directory.html
│   ├── Eat & Drink            /food.html
│   ├── Stay                   /accom.html
│   ├── Do & See               /activity.html
│   ├── Community              /community.html
│   ├── Services               /services.html
│   ├── Add a listing
│   └── Claim / update listing
│
├── Archive                    /archive.html
│
├── Emergency                  /emergency.html
│
└── About & contribute
    ├── Contact
    ├── Suggest correction
    ├── Support
    ├── Advertise
    └── Policies
```

## Navigation direction

A good desktop starting point is:

```text
This Week | What's On | Directory | Eat & Drink | Stay | Do & See | ☰
```

The logo is Home. Do not spend a navigation position on a Home link unless testing shows a clear usability reason.

The secondary menu can contain:

```text
Community
Services
Archive
Emergency
Contact
Add your listing
```

This is a direction, not a rigid requirement. If a cleaner arrangement becomes obvious during implementation, improve it. The important outcomes are:

- **This Week is highly visible and first.**
- What's On remains easy to reach.
- Directory is recognisable as a coherent product.
- Eat & Drink, Stay and Do & See remain convenient visitor shortcuts.
- Community and Services are still easy to find without overcrowding the primary row.
- Emergency remains easy to reach and must never be buried so deeply that it becomes difficult to find.
- Desktop and mobile navigation should use the same conceptual hierarchy.
- Avoid large menus, mega-menu complexity or taxonomy suitable for a city. Mallacoota is a small coastal town of roughly 1,000 permanent residents with a large visitor and older population.

## Retire the standalone Locals page

`/locals.html` is no longer needed as a standalone navigation destination.

“Local of the Week” is editorial content and belongs inside **This Week**. Individual stories remain permanently available through their original edition and the archive.

Implementation requirements:

- Remove **Locals** from primary navigation, hamburger navigation, footer navigation and other site-wide menus.
- Remove internal calls to action that unnecessarily send users to `/locals.html` when the relevant edition or archive is the better destination.
- Preserve SEO and old external links. Do not simply create a 404.
- Prefer a permanent redirect from `/locals.html` to the most appropriate continuing destination, likely `/edition.html` or a suitable archive view.
- If useful, preserve anchors or create an archive filter for local profiles, but do not recreate the same redundant standalone page under another name.

## Preserve URLs and search equity

Do not casually rename established public URLs.

The existing paths such as `/food.html`, `/accom.html`, `/activity.html`, `/community.html`, `/services.html`, `/calendar.html`, `/directory.html`, `/edition.html`, individual `/listing/<slug>.html` pages and permanent edition URLs should remain valid unless there is a strong reason to change them.

Where anything is retired or consolidated:

- use an appropriate 301/permanent redirect;
- preserve canonical signals;
- update internal links;
- keep the sitemap clean;
- remove obsolete URLs from navigation and structured data;
- avoid redirect chains.

## SEO and AI-assisted quality audit

As part of this mission, perform a site-wide SEO audit using both deterministic checks and AI review of the rendered pages. The goal is not generic SEO scoring. The goal is to make the site genuinely clear to search engines, AI search systems and people looking for Mallacoota information.

Review at least:

### Titles and descriptions

- Every important page should have a distinct, useful `<title>`.
- Meta descriptions should describe the actual page, not repeat generic branding.
- Put the useful subject first where appropriate, with Love Mallacoota as the brand.
- Avoid keyword stuffing and repetitive boilerplate.
- Weekly editions should identify Mallacoota, the week/date and the nature of the page clearly.
- Listing pages should produce useful titles/descriptions from verified listing data.

### Headings and page meaning

- One clear H1 per page.
- Logical H2/H3 hierarchy.
- Heading text should describe content rather than serve only decorative purposes.
- AI-review representative rendered pages and flag sections whose purpose is unclear without visual context.

### Canonicals, robots and sitemap

Check:

- canonical URLs;
- `robots.txt`;
- sitemap generation and contents;
- redirects;
- accidental duplicate pages;
- retired `/locals.html` behaviour;
- preview/staging environments are not being indexed as production;
- permanent weekly edition URLs and listing pages are indexable.

### Structured data

Review the existing schema.org output and improve it where it adds real meaning.

Relevant types may include:

- WebSite / WebPage
- BreadcrumbList
- LocalBusiness and more specific business types
- GovernmentOrganization / CivicStructure / Organization where appropriate
- Event
- Article / NewsArticle where appropriate for weekly editorial material
- Person for genuine profile articles where supported by the content

Do not force schema onto pages where it does not fit. Ensure structured data matches visible page content and does not invent facts.

### Internal linking

Use the new hierarchy to improve contextual internal linking:

- This Week should naturally link to relevant calendar events, listings, previous editions and archive material.
- Directory categories should link back to the whole directory where useful.
- Listings should expose relevant category/location context.
- Archive and weekly articles should not become dead ends.
- Breadcrumbs should reflect the information architecture without becoming verbose.

### Local search intent

Optimise naturally for useful queries such as:

- Mallacoota
- what’s on in Mallacoota
- Mallacoota events
- Mallacoota restaurants / cafes / takeaway
- Mallacoota accommodation
- things to do in Mallacoota
- Mallacoota services
- Mallacoota community groups
- Mallacoota weather / tides where the page genuinely provides that information

Do not manufacture pages merely to target keywords. Existing useful content and directory records should do the work.

## AI search / answer-engine readiness

Review the site as if a search or AI system were trying to answer a factual Mallacoota question from it.

Important facts should be:

- in HTML, not hidden behind unnecessary client-side rendering;
- clearly labelled;
- attributable where appropriate;
- dated when freshness matters;
- internally consistent;
- backed by official sources where safety or government information is involved.

Make it easy for a machine to distinguish current weekly information from permanent directory information and historical archive material.

## Open Graph and social images

Social sharing matters heavily for this project because Facebook and other social channels are major distribution paths.

Audit all important pages for:

- `og:title`
- `og:description`
- `og:url`
- `og:type`
- `og:image`
- image width/height where appropriate
- Twitter/X card equivalents or compatible metadata

### Image standard

Use **1200 × 630 px** as the default Open Graph target unless a platform-specific reason supports something else.

Do not rely on one generic Love Mallacoota logo image for every page.

Develop a simple, maintainable OG-image strategy:

- **Home:** a striking recognisable Mallacoota image with restrained Love Mallacoota identity.
- **This Week:** the current edition cover or strongest editorial/cover image, with readable edition/date identity if useful.
- **Permanent weekly editions:** freeze the image used for that edition so old shares do not change later.
- **Directory category pages:** strong representative local photography for Eat & Drink, Stay, Do & See, Community and Services.
- **Listing pages:** use the listing's strongest approved image where available; fall back to an appropriate category image rather than a blank/generic card.
- **Articles:** use the article's lead image where rights allow.
- **Calendar/What's On:** use a recognisable Mallacoota community/event image or a clean branded fallback.
- **Archive:** use imagery that clearly signals local history/archive rather than tourism.
- **Emergency:** keep sober and functional; do not use dramatic/generated disaster imagery.

Prefer Colin's real Mallacoota photography and existing approved project images. Do not use invented AI scenes that could be mistaken for real Mallacoota places, events, people or conditions.

Where useful, create a reusable OG-image generator/template so future editions and listings can produce consistent images without manual graphic design. Keep text large enough to survive Facebook thumbnail rendering and avoid cramming cards with metadata.

Test the final rendered metadata, not only source components.

## Content and visual quality check

Use AI review as a second pass across representative pages at desktop and mobile widths. Look for:

- duplicate calls to action;
- pages with too many competing choices;
- weak or generic hero copy;
- unclear page purpose;
- navigation labels that do not match user intent;
- important material hidden below low-value material;
- old language left over from the site's tourism-directory-only phase;
- broken image crops in OG/social contexts;
- accessibility problems caused by the navigation changes.

Do not rewrite good local copy merely to make it sound like SEO copy.

## Performance and accessibility

Do not sacrifice the project's static-first performance for navigation or SEO tooling.

- Keep navigation lightweight.
- Avoid unnecessary client JavaScript.
- Maintain keyboard navigation and visible focus states.
- Ensure hamburger/menu controls expose correct ARIA state.
- Keep touch targets suitable for older users.
- Maintain WCAG 2.1 AA as the practical target.
- Optimise OG and page imagery rather than shipping unnecessarily large originals.

## Validation

Before considering the mission complete:

1. Run the existing project checks/tests.
2. Crawl or otherwise inspect every public route generated by the site.
3. Check for broken internal links and redirect loops.
4. Check canonical URLs and sitemap output.
5. Validate representative structured data.
6. Inspect rendered metadata for Home, This Week, a permanent edition, What's On, Directory, each directory category, several listings, Archive and Emergency.
7. Verify `/locals.html` resolves cleanly to its replacement.
8. Test primary/hamburger/footer navigation at desktop, tablet and narrow mobile widths.
9. Check keyboard-only operation.
10. Check representative OG cards at 1200 × 630 and ensure crops/text remain useful when reduced to social-preview size.
11. AI-review the resulting pages for clarity and search intent, then fix genuine issues rather than chasing an arbitrary score.

## Success criteria

The work is successful when a new visitor can quickly understand that Love Mallacoota has two main jobs:

1. **This Week:** what is happening in Mallacoota now.
2. **Directory:** where to find things, businesses, services and community organisations.

A resident should be able to get to This Week or What's On immediately. A visitor should be able to find food, accommodation and activities immediately. Search engines and AI systems should receive clear, stable, well-structured information. Shared links should look excellent on Facebook and other social platforms.

Keep it simple. This is a useful local service for a small coastal town, not a large media portal.
