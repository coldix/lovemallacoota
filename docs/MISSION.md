# Love Mallacoota - Community Information Platform

**Status:** Active public build  
**Updated:** 30/08/2026  
**Repository:** https://github.com/coldix/lovemallacoota  
**Site:** https://lovemallacoota.au  
**Current implementation:** v0.50 at the time of this revision  
**Licence:** Code MIT. Original platform content CC BY 4.0. Submitted and archived material retains its own rights.

## 1. Mission

Love Mallacoota is a free, open local information platform for Mallacoota and district.

The Mallacoota Mouth closed and removed a useful common place for local notices, events, stories and practical information. Facebook remains important, but information scattered across groups is difficult to find later and inaccessible to people who are not using the right group at the right time.

Love Mallacoota provides a permanent public front door for the town. The website is the record. Facebook, YouTube, email and other channels are distribution.

The project builds something useful first, improves it in public, and lets the community decide how much of it to use or eventually adopt.

## 2. The centre of the site: This Week

**This Week is the main current-information product and should be prominent in the primary navigation.**

`/edition.html` is the current weekly edition. Each edition combines contributed and automatically refreshed material in one place, including:

- local notices and community updates
- local stories and Local of the Week
- events and links into What's On
- weather, tides and moon information
- transport information
- Trail of the Week
- Business of the Week
- video and 360 content where useful
- advertising that is clearly labelled

Past editions remain permanently available at `/edition/<year>-w<week>.html`, with printable PDF versions.

The weekly edition is not a separate side project. It is the current layer of Love Mallacoota and should be one of the first things residents see.

## 3. Information architecture

The site should be understandable without knowing how it was built. A user should be able to answer one of four questions quickly:

1. What is happening now?
2. What is on?
3. Where can I find a business, service, club or place?
4. Where can I find older or official information?

Recommended structure:

```text
Love Mallacoota
|
|-- This Week                      /edition.html
|   |-- Notices
|   |-- Community updates
|   |-- Local stories / Local of the Week
|   |-- Weather, tides and moon
|   |-- What's On highlights
|   |-- Transport
|   |-- Trail / Business / Video of the Week
|   `-- Previous editions
|
|-- What's On                      /calendar.html
|   |-- Community calendar
|   `-- Submit an event
|
|-- Directory                      /directory.html
|   |-- Eat & Drink                /food.html
|   |-- Stay                       /accom.html
|   |-- Do & See                   /activity.html
|   |-- Community                  /community.html
|   |-- Services                   /services.html
|   |-- Add your listing
|   `-- Claim / update a listing
|
|-- Archive                        /archive.html
|
|-- Emergency                      /emergency.html
|
`-- About & contribute
    |-- Contact / suggest a correction
    |-- Support
    |-- Advertise
    `-- Editorial, privacy, accessibility and terms
```

### Recommended primary navigation

Keep the desktop navigation short and task-oriented:

```text
This Week | What's On | Directory | Eat & Drink | Stay | Do & See | More
```

`More` contains:

```text
Community
Services
Archive
Emergency
Contact
Add your listing
```

The logo always returns to Home. Mobile navigation may show the same hierarchy expanded rather than trying to reproduce the desktop row exactly.

### Retire `locals.html` as a standalone destination — done

`/locals.html` is no longer a navigation concept. Local of the Week is an article type within the weekly edition, not a separate product.

The route is permanently redirected to `/archive.html`, which indexes every profile and links each one to the edition that published it. Each index row carries the anchor the old page used, so deep links shared before the change still land on the right story. Existing local stories remain part of their original weekly editions and are not duplicated anywhere.

## 4. What Love Mallacoota carries

- This Week, the current weekly community edition
- What's On and the community calendar
- notices from clubs, groups, schools, services and residents
- a searchable business, community and services directory
- local stories and history
- an archive of past editions and, where permission exists, older local publications
- visitor information and links to TrailBound where detailed trail information belongs
- relayed official and emergency information

Residents and visitors use the same platform. In Mallacoota the same person may want the tide, bakery hours, a market date, a community notice and a walking track on the same day.

## 5. Principles

### Free to the community

No fee to read, submit a community notice, submit an event, or have a normal directory listing. No paywall.

### Open by default

The code and public structured content live in GitHub. The system should be auditable, portable and capable of being handed over.

### Useful beats complicated

Mallacoota is a small coastal town. The site should not grow an enterprise information architecture or unnecessary layers. Add a page only when it serves a distinct user task.

### Low effort to operate

The system must survive without daily manual attention. Prefer structured submissions, scheduled refreshes, automatic weekly rollover, reusable components and simple moderation.

### Official sources first for safety

For emergencies, navigation, weather warnings and other safety-critical information, link to the responsible authority and state the limitations of Love Mallacoota's information clearly.

### The site is the record

Social platforms distribute information. They do not own the archive or determine whether information remains findable.

## 6. Editorial position

Love Mallacoota can publish reporting, opinion, advocacy and political discussion when it is relevant to the district.

The standard is not neutrality at any cost. The standard is accuracy, attribution and fairness about what is fact, opinion or advocacy.

Allowed material includes:

- criticism of council, government or agency decisions
- advocacy for better roads, services, facilities, funding or local autonomy
- arguments for or against local proposals
- election material and candidate responses
- clearly labelled political advertising that meets Australian authorisation requirements

Not acceptable:

- personal attacks presented as reporting
- defamatory or knowingly false claims
- invented facts, quotes, events, classifieds or people
- harassment or material that creates an unreasonable safety risk

Corrections are made visibly and retained in the repository history. A person, group or business may request correction of factual information about themselves.

The detailed rules live in the site's Editorial Policy, Corrections, Privacy and Terms pages. Those current published policies take precedence over older planning notes.

## 7. Photographs and community material

Photographs taken in public may be used for normal editorial and community coverage, subject to Australian law and the published privacy policy.

A photograph of a person is not used to imply a commercial endorsement without permission. Children are handled more conservatively, with family, school or appropriate organiser involvement.

If someone shown in a photograph asks for removal or blurring, the practical policy is to do so where reasonably possible without requiring them to justify the request.

## 8. Emergency and safety information

Emergency information has stricter rules:

1. Relay official information rather than inventing original emergency advice.
2. Show timestamps and link directly to the issuing authority.
3. State prominently that 000 and VicEmergency are the official emergency channels.
4. Remove stale relayed information when it cannot be kept current.
5. Do not turn social media rumour into emergency information.

Modelled tide and sea-level information on the site is indicative, not a navigational tide table. Users crossing the Mallacoota bar must be directed to appropriate official or specialist sources.

## 9. Directory model

The directory is one dataset with filtered views, not several unrelated mini-sites.

Its main branches are:

- Eat & Drink
- Stay
- Do & See
- Community
- Services

Listings can be added, claimed and maintained without a conventional account. Verification is by email. Official government and emergency listings cannot be privately claimed.

A normal directory listing is free and should remain free.

## 10. Funding

The aim is to keep community access free while making the platform capable of paying its modest running and maintenance costs.

Current routes are:

- advertising: $35 per month
- supporter payment: $10
- voluntary contribution: amount chosen by the contributor

Advertising is clearly labelled and is separate from free directory inclusion. Love Mallacoota is not a registered charity or deductible gift recipient, and is not registered for GST at the time of this revision.

Any future contributor revenue-sharing arrangement must be documented before money is distributed.

## 11. Technology and operating model

- Astro, static-first
- Cloudflare Worker and static assets
- Cloudflare D1 for submission and management state
- GitHub for source control and published structured content
- GitHub Actions for preview deployment, weekly refresh, edition rollover and image processing
- Turnstile and rate limiting on public forms
- structured JSON for directory and weekly edition content
- responsive, accessible output with WCAG 2.1 AA as the target

Pushes to `main` deploy an isolated preview. Production deployment is a deliberate maintainer action.

The design should remain portable. No important community content should depend on a proprietary editor or an inaccessible database export.

## 12. Relationship with other OZE projects

- `lovemallacoota.au` is the community information and local guide platform.
- `trailbound.au` carries detailed trail and trip information and can feed selected features into Love Mallacoota.
- `coota.au` may link to or complement Love Mallacoota but should not duplicate its core current-information function.
- other OZE properties may share infrastructure or components while retaining their own purpose.

## 13. Governance and handover

The project is currently built and maintained by Colin Dixon under the OZE network.

The intention is community benefit, not dependency on one maintainer. If a suitable Mallacoota community body eventually wants to adopt or participate in the platform, the repository, data and operating knowledge should make that practical.

The domain names remain separately owned unless an explicit future agreement changes that.

## 14. Measures of success

By the end of 2026 the platform should demonstrate:

- a useful weekly edition published reliably
- a current community calendar
- a directory broad enough to answer normal local and visitor needs
- real businesses and groups maintaining their own listings
- community submissions that do not require constant maintainer chasing
- a practical archive that grows without copyright shortcuts
- operation that can continue through a period when the maintainer is unavailable

The most important operational measure is maintainer time. If routine publishing regularly requires many hours of manual work, the design needs simplifying or automating.

## 15. Open questions

- What the MADRA community survey shows people actually want.
- Permission and copyright status for publishing historical Mallacoota Mouth editions, as distinct from cataloguing them.
- Whether advertising and supporter contributions are enough to sustain maintenance over time.
- Whether a broader contributor or governance model becomes useful once the platform has real participation.
- Whether the `/locals.html` redirect to the archive index can eventually be dropped, once external links have had time to age out.
