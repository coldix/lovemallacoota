# Love Mallacoota rebuild plan

**Source:** Codex (ChatGPT), with decisions recorded by Chief of Staff 27 August 2026
**Status:** phase-one Astro release `v0.07` complete; production deployment authorised.
**Repo:** https://github.com/coldix/lovemallacoota
**Working copy:** `/Users/dixon/web/lovemallacoota`
**Canonical site:** https://lovemallacoota.au

Related docs already in this folder:

- [`MISSION.md`](MISSION.md) — why the platform exists, editorial and emergency rules
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — Cloudflare cutover and Hostinger rollback
- [`ARCHIVE.md`](ARCHIVE.md) — Mouth PDF / R2 / rights workflow

Codex reviewed the supplied sample *Edition 1771 18th June 2020 Electronic Version.pdf* and the mission document.

**Current tree (28 Aug 2026):** Astro generates the public pages while a Cloudflare
Worker serves static assets, applies security headers and handles canonical and
legacy redirects. The temporary Worker preview is verified. Production release
`v0.07` has been authorised for deployment to `lovemallacoota.au`.

Do not publish the supplied Mouth edition until copyright permission is documented. Keep the original PDF unchanged.

---

## Confirmed decisions (27 August 2026, ~23:14 AEST)

Colin confirmed. Codex recorded. Canonical domain:

https://lovemallacoota.au

Both assigned Cloudflare nameservers are correctly registered:

- `dilbert.ns.cloudflare.com`
- `jewel.ns.cloudflare.com`

Public DNS resolvers still showed the previous nameservers minutes after the change. That propagation delay is normal.

### Domain plan

- `lovemallacoota.au/*` → serve the new Cloudflare-hosted site
- `www.lovemallacoota.au/*` → 301 to `lovemallacoota.au/*`
- `lovemallacoota.com.au/*` and its www host → 301 to the matching `.au` path
- `lovemallacoota.com/*` and its www host → 301 to the matching `.au` path

Redirects must retain the complete path and query string. Example:

`https://lovemallacoota.com.au/calendar.html` → `https://lovemallacoota.au/calendar.html`

Also:

- Update canonical URLs, sitemap, structured data, Open Graph URLs and newsletter links to `.au`
- Preserve existing Hostinger MX/SPF records for `.com.au` and `.com` during DNS migration
- Newsletter sender: something like `news@lovemallacoota.au`
- Add `.au`, `.com.au` and `.com` to Google Search Console and submit the new sitemap
- Keep the old Hostinger website available temporarily for rollback, but never serve duplicate public content
- `.com.au` and `.com` must also be added as zones under the same Cloudflare account before their Worker redirects can activate

### Progress log

**23:14** Begin first implementation slice.

**23:15–23:23** Slice complete locally (about 7m 30s). Not deployed. Not committed. Version `v0.06`.

Implemented locally:

- Cloudflare Worker static-assets deployment foundation
- `lovemallacoota.au` canonical URLs throughout
- `.com.au`, `.com`, www, and old WordPress redirects
- Cloudflare GitHub Actions deployment workflow
- Explicit public-file build that excludes docs, PDF, legacy data and junk
- Custom 404 and security headers
- MADRA survey campaign panel using the corrected live URL
- Mobile overflow fix
- Removed both `.DS_Store` files
- Mission renamed to `docs/MISSION.md`

Key files: `src/worker.ts`, `wrangler.jsonc`, `docs/DEPLOYMENT.md`, `index.html`, `tools/public-files.mjs`, `.github/workflows/deploy.yml`

Validation passed locally: 4 redirect/Worker tests, TypeScript check, Wrangler dry-run, desktop and mobile visual review, no mobile horizontal overflow, SurveyMonkey link live, `.html` URLs unchanged.

Codex offered Turnstile setup next. Do not start that until Colin says proceed.

**23:23** Colin: the domain is active. The old Mouth newsletter was publicly distributed like any community newsletter. He expects to collect a couple of dozen issues; someone may have around 100. Archive is a real project: indexed, searchable reproduction.

**23:26** Archive added as a separate track (see [`ARCHIVE.md`](ARCHIVE.md)): issue catalogue, full-text index, searchable issue pages, original PDFs in R2. Public distribution is not automatically public domain. Record rights/permission per issue. Keep the archive technically ready without unsupported legal assumptions.

Seed record: Issue 1771, 18 June 2020, 28 pages, checksum recorded. Public index can show what is catalogued; source PDF stays in private working/docs until reuse basis is recorded.

**Later that night** Codex hit its usage limit: “try again at 28 Aug 2026, 03:39.” Astro rebuild is the next implementation step after that.

**28 August, 06:18** Astro conversion and phase-one information pages completed.

- 14 Astro-generated routes now share layout, navigation, footer and metadata components
- Existing `/`, `.html` directory, calendar, archive and contact URLs are preserved
- Added privacy, terms, editorial, corrections, emergency and accessibility pages
- Added the community-platform and newsletter-interest callout
- Added an isolated `preview` Worker environment with no custom-domain routes
- Validation passed: Astro build, Worker types, six tests and Wrangler dry runs
- Temporary preview deployed at `https://lovemallacoota-preview.col-ab2.workers.dev`

Production custom-domain cutover was authorised by Colin on 28 August 2026. The
release must be committed and validated before the production command is run.

**Production cutover note:** the first production upload completed but route setup
exposed two configuration prerequisites. The `.au` apex had no DNS record, so it
was changed from a Worker route to a Worker Custom Domain. The `.com.au` and `.com`
zones are not yet in this Cloudflare account, so their redirect routes remain
pending rather than blocking deployment of the canonical `.au` site.

**08:04, 28 August:** production deployment succeeded. Cloudflare created Custom
Domains for the `.au` apex and `www`; the apex returned the Astro home page with
the expected security headers, and `www` returned one permanent redirect preserving
the requested path and query. Release `v0.07` is live. Legacy-domain cutover remains
pending until the `.com.au` and `.com` zones are added to this Cloudflare account.

---

## Recommended approach

Rebuild Love Mallacoota using the same basic pattern as TrailBound: Astro-generated pages deployed as Cloudflare Worker static assets, with a small Worker API for forms and newsletter integration.

The mission is strong and technically achievable. The historical Mouth confirms the core content model: events, public notices, community updates, school/youth content, history, classifieds, advertising, and service information.

Published content should remain in Git as Markdown or JSON. That gives the project version history, portability, corrections, and public accountability. D1 should hold pending submissions and operational records — not become the only copy of published community content.

Cloudflare supports deploying static assets and Worker API logic together, which fits this hybrid model well. See [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).

### Architecture

```text
GitHub repository
  ├─ Astro pages and components
  ├─ Published articles/events/notices
  └─ GitHub Actions deployment
               │
               ▼
Cloudflare Worker + Static Assets
  ├─ Website and RSS feeds
  ├─ Redirects and API routes
  ├─ Submission/newsletter forms
  └─ Scheduled digest trigger
        │          │          │
        ▼          ▼          ▼
       D1          R2      Buttondown
  submissions   PDFs/images  subscribers
  moderation     archive     newsletters
```

---

## Implementation plan

### Phase 1 — Immediate foundation: 28–31 August

- Remove `.DS_Store` and confirmed legacy junk; update `.gitignore`.
- Convert the current HTML site to Astro using TrailBound’s project structure and shared deployment conventions.
- Preserve all existing URLs and SEO metadata.
- Replace `.htaccess` rules with Worker redirects.
- Add proper `404.html`, privacy, terms, editorial policy, corrections policy, emergency disclaimer, and accessibility statement.
- Add a prominent MADRA survey notice linking to the SurveyMonkey survey until 9 September.
- Add “Community platform in development” and newsletter-interest signup sections.
- Keep business directory and visitor pages operating during the rebuild.

**Deliverable:** a locally tested Astro site deployable to a temporary `workers.dev` address.

### Phase 2 — Move hosting to Cloudflare: 1–3 September

- Add `wrangler.jsonc`, Worker routing, Astro build configuration, tests, and deployment scripts.
- Create the Love Mallacoota Worker and preview deployment.
- Replace the Hostinger GitHub Action with a Wrangler deployment workflow.
- Move the DNS zone from Hostinger nameservers to Cloudflare.
- Recreate all existing DNS and email records before changing nameservers.
- Connect:
  - `lovemallacoota.com.au`
  - `www.lovemallacoota.com.au`, redirected to the apex
- Enable HTTPS, observability, caching, Web Analytics, security headers, and rollback deployment.
- Keep Hostinger intact for at least seven days as a rollback source.

Cloudflare can serve the assets and Worker as one deployment, matching the TrailBound setup. Static files can bypass Worker execution while `/api/*` routes invoke application logic.

### Phase 3 — Content platform MVP: 3–7 September

Primary sections:

- News and updates
- What’s On
- Community notices
- Groups, clubs and services
- School, youth and sport
- Local history
- Business directory
- Visitor information, with TrailBound links
- Emergency and official information links
- Mouth archive

Content records should support:

- Title, summary and body
- Content type and category
- Publishing and expiry dates
- Source organisation and contact
- Authoritative source URL
- Correction history
- Newsletter inclusion
- Emergency-source and timestamp fields
- Draft, approved, published and archived states

Generate individual pages, section indexes, search data, RSS/Atom feeds, sitemap entries, and structured metadata during the Astro build.

### Phase 4 — Newsletter MVP: 5–8 September

Buttondown as the campaign/list provider, connected through a first-party form on Love Mallacoota.

Signup flow:

1. Visitor enters their email on lovemallacoota.com.au.
2. Worker validates the request and Turnstile token.
3. Worker sends the address to Buttondown’s API.
4. Buttondown sends a double-opt-in confirmation.
5. Only confirmed subscribers receive newsletters.

Every message contains sender details and a working unsubscribe link.

Buttondown supports API-created subscribers with double opt-in and scheduled RSS-to-email digests. [Subscriber API](https://docs.buttondown.com/api-subscribers-create), [RSS-to-email](https://docs.buttondown.com/rss-to-email).

Use a dedicated provider because it handles unsubscribe state, bounces, complaints and sender reputation. Cloudflare Email Service is better reserved for transactional messages such as submission receipts; its sending domain also requires Cloudflare DNS. [Cloudflare Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/).

Newsletter features:

- Weekly or fortnightly digest
- Email preview and test-recipient step
- Manual approval before initial sends
- Automatic draft generation from the site RSS feed
- Plain-text and HTML versions
- Public web archive
- Source links back to the canonical website
- Optional categories later
- No subscriber import from MADRA membership without explicit newsletter consent

Because newsletters may include advertising or sponsored material, implement Australian spam requirements from day one: consent evidence, sender identification, contact details and functional unsubscribe. [ACMA unsubscribe guidance](https://www.acma.gov.au/sites/default/files/2024-05/Fact%20sheet%20-%20email%20and%20SMS%20unsubscribe%20rules.pdf).

### Phase 5 — Community submission workflow: 8–14 September

Public submission forms for:

- Event
- Community notice
- Group update
- Listing correction
- Business listing
- Historical contribution

Each form should have:

- Cloudflare Turnstile
- Server-side validation and rate limiting
- File upload restrictions
- Consent and publishing licence checkbox
- Receipt email
- D1 pending-submission record
- Moderation status and audit history

Turnstile tokens must always be validated server-side. [Cloudflare Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Initially, moderation can occur through a simple protected dashboard. Approval should generate or update the repository content and trigger the normal static deployment.

### Phase 6 — Archive and media: after permissions

- Store authorised Mouth PDFs and uploaded images in R2.
- Create archive metadata: issue, date, editor, topics and searchable extracted text.
- Generate accessible issue pages and PDF download links.
- Do not publicly upload the supplied Mouth edition until copyright permission is documented.
- Retain the original PDF unchanged.
- Add OCR/search text as derivative metadata, clearly linked to its source issue.

See [`ARCHIVE.md`](ARCHIVE.md) for the more detailed intake and rights model already written for this repo.

### Phase 7 — Reliability and handover

Before launch:

- Accessibility audit against WCAG 2.1 AA
- Mobile and slow-network testing
- Broken-link and HTML validation
- Worker/API unit tests
- Form abuse and rate-limit tests
- Newsletter confirmation/unsubscribe tests
- Backup/export procedures for D1, R2 and subscribers
- Emergency-content expiry tests
- Maintainer runbook and recovery instructions
- Measure the actual weekly moderation workload

---

## Suggested release sequence

| Date | Target |
| --- | --- |
| By 3 September | Cloudflare preview deployment ready |
| By 5 September | Production DNS migration complete |
| By 7 September | Survey promotion and newsletter signup live |
| By 9 September | Initial audience/interest data captured before the survey closes |
| By 14 September | Submission and moderation workflow operational |
| Late September | First manually approved newsletter |
| October | Automatic draft digests and authorised archive pilot |

The first newsletter should be manually approved. Once several editions have produced reliable results, switch to automatic draft creation — but retain a human “send” decision until the editorial process is proven.

---

## v0.08 — Fix what is broken (28 August 2026)

Worked from the review in [`NEXTSTEPS.md`](NEXTSTEPS.md).

- Listings and their `LocalBusiness` JSON-LD are rendered by Astro at build time
  (`src/lib/listings.mjs`, `src/components/DirectoryPage.astro`). The page script
  now only filters cards that are already in the HTML, so the directory is
  visible to crawlers and to anyone whose JavaScript does not run.
- Home page counts and the `WebSite` JSON-LD are also build-time.
- The contact form posts to a Worker route, `/api/submit`, behind Turnstile and a
  rate limit, and sends through the Cloudflare Email Sending binding.
- `listings_other.json` folded into `listings_do.json`; the bare-object file is
  gone.
- `/index.html` now redirects to `/`.
- `LICENSE` (MIT) and `CONTENT-LICENCE.md` added; the footer no longer claims
  "all rights reserved" against a mission that promises the opposite.
- Build test fails if a page references an image the build does not contain.

Outstanding from v0.08: the 42 listing photographs referenced by the data do not
exist in the repository, on either live site, or in the Internet Archive. They
are omitted from the structured data until the files turn up. `pnpm run
check:images` lists them.
