# MISSION — Build Love Mallacoota into the town's complete community directory

**Repository:** `coldix/lovemallacoota`  
**Local path:** `/Users/dixon/web/lovemallacoota`  
**Site:** https://lovemallacoota.au/  
**Status:** Build mission for SuperGrok  
**Date:** 29/08/2026

## Your mission

Take the existing Love Mallacoota site and turn it from a good visitor-oriented guide into a genuinely useful **whole-of-community information platform for Mallacoota and district**.

Do not merely bolt a few extra pages onto the existing structure. Review the current site, data model, navigation, directory components, forms, Worker/API code and existing mission, then design and implement the best coherent solution.

You have broad liberty to optimise and improve this concept. The direction below is the intent, not a pixel-perfect specification. If you can make the information architecture, UX, data model, workflows, accessibility or implementation substantially better, do so.

The objective is to make this **great**, not merely complete.

---

## 1. The problem

The current public site is still shaped mainly around visitor needs:

- Eat & Drink
- Stay
- Do & See
- What's On

That works well for tourism, but a large part of Mallacoota has nowhere natural to live in the directory.

Missing or poorly represented areas include:

- community clubs
- sporting clubs
- social groups
- arts and cultural groups
- volunteer organisations
- schools and youth organisations
- churches and faith groups
- environmental groups
- fishing and boating organisations
- community facilities
- government and public services
- health and community services
- emergency organisations
- trades
- professional services
- retail and other businesses
- local media
- radio
- publications
- galleries
- public institutions

The site should become the place where a resident or visitor can answer:

> Who does this in Mallacoota, where are they, how do I contact them, when are they open or meeting, and what is happening next?

---

## 2. Product goal

Build a unified Mallacoota directory and contribution system that can represent **businesses, clubs, organisations, government entities, services and community groups as first-class entities**.

The system should remain:

- fast
- static-first where practical
- Cloudflare-native
- easy to maintain
- accessible
- useful on mobile
- resistant to spam
- free for community organisations to use
- simple enough that ordinary local organisations can maintain their own information

Avoid turning it into a complicated membership application or CMS.

The guiding rule is:

> The organisation should maintain its own information wherever practical, while Love Mallacoota retains enough moderation and verification to keep the directory trustworthy.

---

## 3. Information architecture

Review the current navigation and improve it so community information is as easy to find as visitor information.

A likely top-level structure is:

- Eat & Drink
- Stay
- Do & See
- Community
- Services
- What's On

Secondary navigation can contain things such as:

- Locals
- Archive
- Emergency
- Contact
- About / policies where required

Do not treat this proposed structure as sacred. If a better naming system or navigation hierarchy produces a clearer site, use it.

### Community should comfortably cover

- Clubs & Groups
- Sporting Clubs
- Social Groups
- Arts & Culture
- Community Organisations
- Volunteer Organisations
- Youth & Education
- Churches & Faith
- Environment & Landcare
- Fishing & Boating
- Media & Communications
- Community Facilities

Examples include the art gallery, local radio, community halls, clubs, volunteer groups and other organisations that are not conventional businesses.

### Services should comfortably cover

- Trades
- Professional Services
- Automotive & Marine
- Health & Allied Health
- Retail & Shopping
- Home & Garden
- Community Services
- Government & Public Services
- Emergency Services
- Transport
- Education
- Utilities

Government and public entities must not be made to look like commercial businesses. Their entity type and presentation should make their status obvious.

---

## 4. Homepage

Review the homepage so the public immediately understands that Love Mallacoota is more than a tourism site.

The existing visitor categories should remain prominent, but Community and Services should have equal legitimacy.

A likely directory entry set is:

- Eat & Drink
- Stay
- Do & See
- Community
- Services
- What's On

Use good judgement on layout. Six cards may work, but optimise for clarity, aesthetics and mobile behaviour rather than blindly following that exact design.

---

## 5. One unified entity model

Avoid creating a separate bespoke data system for every category.

Move toward a unified entity model capable of representing:

- business
- trade
- professional service
- community organisation
- sporting club
- social group
- arts/cultural organisation
- government/public service
- school/education entity
- church/faith group
- emergency service
- media/publication/radio
- community facility
- other legitimate local entity types

A useful entity model may include fields such as:

```text
id
slug
name
entityType
categories[]
description
address
location
serviceArea
phone
email
website
social[]
openingHours
meetingTimes
accessibility
images/logo
status
verified
verifiedDate
verificationMethod
maintainerEmail
createdAt
updatedAt
```

This is illustrative, not prescriptive.

Design the schema properly for the actual application and future extension.

Pages such as Food, Accommodation, Activities, Community and Services should ideally become filtered views over the same underlying entity system where that makes architectural sense.

Preserve existing public URLs or provide clean redirects where changing them is worthwhile.

---

## 6. Self-registration

This is a major objective.

Create a prominent, friendly workflow such as:

**Add your listing — free**

The first step should establish the type of entity being submitted, for example:

- Business
- Trade or professional service
- Club
- Sporting organisation
- Community group
- Arts/cultural organisation
- Government/public service
- School/education
- Church/faith group
- Media/publication/radio
- Community facility
- Other

The form should adapt intelligently where useful rather than presenting every possible field to everyone.

Collect enough information to make the listing genuinely useful, including where relevant:

- organisation name
- type/category
- description
- address/location
- service area
- phone
- public email
- website
- Facebook/social links
- opening hours
- meeting times
- accessibility information
- contact person's name
- contact person's email
- logo/photo
- recurring meeting details
- events/calendar link

Include an explicit statement such as:

> I am authorised to submit or maintain this listing.

Do not require a traditional account/password system unless there is an overwhelming technical reason.

---

## 7. Claim this listing

Seed the directory ourselves rather than waiting for every organisation to discover the site.

Existing entries should support a clear action such as:

**Is this your organisation? Claim this listing.**

A representative can then establish that they are authorised to maintain it.

Design a sensible verification process. This may involve email-domain verification, an email challenge, manual approval, or another method appropriate to the organisation type.

Once claimed and verified, record that status and show it meaningfully on the public listing.

Avoid implying that Love Mallacoota independently endorses an organisation simply because its representative has confirmed the listing.

---

## 8. No passwords: use secure edit links / magic links

Prefer a low-friction model where an authorised maintainer receives a secure private management link or magic link.

From that interface, they should be able to propose or make appropriate changes such as:

- description
- phone/email
- website/social links
- address or service area
- opening hours
- meeting times
- accessibility information
- temporary closure/status
- logo/photo
- event submission
- recurring meetings

Use secure, expiring or revocable tokens as appropriate. Do not store raw sensitive tokens insecurely.

Make this safe without making it burdensome.

---

## 9. Moderation and publishing workflow

Do not allow arbitrary anonymous content to publish straight to the live site.

A sensible baseline workflow is:

```text
Submitted
→ email/identity check where appropriate
→ pending review
→ approved
→ published
→ optionally claimed/verified
```

However, design this intelligently.

Trusted or previously approved contributors may eventually be able to update low-risk fields or submit events with little or no moderation.

The goal is not bureaucracy. The goal is trustworthy information with very low maintainer workload.

The existing Love Mallacoota principle still applies:

> If routine operation requires more than a couple of hours a week from one person, the design is wrong.

---

## 10. Verification

Improve the current concept of "verified".

A listing may have different levels or sources of verification, for example:

- organisation representative confirmed
- official government source
- manually checked
- unclaimed community listing

Display verification honestly and clearly.

Useful public information might include:

- Verified/confirmed status
- Last confirmed date
- Official service indicator where appropriate

Do not create false authority or imply endorsement.

Also consider stale-data handling. A directory can become misleading if a listing has not been checked for years.

Design a lightweight renewal/reconfirmation mechanism if practical.

---

## 11. Directory listing versus publishing contribution

Treat these as two related but separate concepts.

### Directory listing

Who they are, where they are, what they do, and how to contact them.

### Contribution

What they want to publish now:

- event
- notice
- update
- meeting
- announcement
- correction

An organisation should register or claim itself once, then be able to submit future community information without repeatedly re-entering everything.

This is important to the larger Love Mallacoota mission. The site is intended to become the town's communications platform, not merely a bigger Yellow Pages.

---

## 12. What's On integration

Make it easy for a club or organisation to submit an event while maintaining a connection between the event and the organisation that submitted it.

Consider support for:

- one-off events
- recurring events
- club meeting schedules
- markets
- exhibitions
- sporting fixtures
- public meetings
- community notices

Avoid making contributors fill out the same organisation data every time.

If an entity is claimed/verified, event submission should become extremely easy.

---

## 13. Government and official entities

Government and public information deserves special handling.

Examples may include:

- East Gippsland Shire Council
- Parks Victoria
- Victoria Police
- CFA
- Ambulance Victoria
- health/community health services
- transport authorities
- Services Australia or other government services relevant to Mallacoota

Where possible, use authoritative source URLs and clearly identify the entity as official.

Do not allow a normal public claimant to impersonate or take over an official government listing.

Verification and claiming rules should reflect the higher trust requirement.

Emergency content must continue to obey the existing emergency-information rules in the primary project mission.

---

## 14. Local media and social channels

The site already acknowledges that Mallacoota communicates heavily through Facebook and other local channels.

Make local media, radio, publications and useful public social groups discoverable without letting them dominate the core directory.

Potential categories include:

- Radio
- Local publications
- Community Facebook groups/pages
- News and notices
- Community media

The directory should point people to useful external channels while keeping Love Mallacoota itself as the durable record and directory.

---

## 15. Search, filtering and discovery

As the directory grows, category pages alone will not be enough.

Implement or prepare for excellent discovery:

- full directory search
- category filters
- entity-type filters
- useful tags
- A–Z browse if worthwhile
- location/service-area filtering where useful
- clear empty states

Search must be fast on mobile and usable by older residents.

Do not overcomplicate the UI.

---

## 16. Maps

Where location is genuinely useful, integrate map/location information sensibly.

Do not force every entity to have a precise street address. Many community groups meet at different locations or serve the whole district.

Support concepts such as:

- physical address
- meeting location
- service area
- no public address

Respect privacy where a home address should not be published.

---

## 17. Technical direction

Work with the existing architecture rather than replacing good systems unnecessarily.

The project is currently Astro + Cloudflare Workers/Static Assets with structured data and existing submission infrastructure.

Prefer:

- Astro/static-first rendering
- Cloudflare Workers for APIs and secure workflows
- D1 where mutable structured data is appropriate
- R2 for uploaded images where appropriate
- Turnstile
- server-side validation
- rate limiting
- clean structured data
- GitHub-managed code and deployment

Do not expose secrets or sensitive maintainer data in public JSON/static assets.

If the present data architecture needs migration, implement it safely and document it.

---

## 18. Spam, abuse and security

Self-registration introduces abuse risk.

Build reasonable protection including:

- Cloudflare Turnstile
- honeypot where appropriate
- server-side validation
- rate limiting
- safe file/image handling
- safe URL validation
- no arbitrary HTML submission
- prevention of listing takeover
- stronger rules for government/official entities
- audit trail for important changes

Do not make legitimate local use frustrating in the name of theoretical security.

---

## 19. Accessibility and audience

A significant part of Mallacoota's population is older.

Build for that reality.

Prioritise:

- readable typography
- strong contrast
- obvious controls
- generous touch targets
- simple forms
- useful validation messages
- keyboard operation
- screen-reader semantics
- minimal cognitive load

Target WCAG 2.1 AA or better where practical.

---

## 20. SEO and structured data

Use appropriate schema.org structured data where it adds value.

Different entity types should be represented appropriately rather than forcing everything into LocalBusiness.

Maintain clean titles, descriptions, canonical URLs and useful directory pages.

Consider how individual entity pages can rank for searches such as:

- Mallacoota golf club
- Mallacoota art gallery
- Mallacoota plumber
- Mallacoota radio
- Mallacoota community health
- Mallacoota CFA

---

## 21. Migration and seeding

Do not throw away the good existing food, accommodation and activity listings.

Migrate or adapt them into the improved model where appropriate.

Create initial Community and Services records from trustworthy existing information already in the repo or from clearly authoritative public sources where sensible.

Do not invent facts.

The system must also make it easy to add the missing organisations later without code changes.

---

## 22. Design quality

This matters.

The site should feel like one coherent, high-quality product, not an accumulation of forms and database screens.

Preserve and improve the visual identity of Love Mallacoota.

Aim for:

- warm local character
- excellent photography where available
- uncluttered pages
- obvious hierarchy
- polished cards
- thoughtful empty/loading/success states
- strong mobile design
- quick navigation

Make Community and Services look as intentional and attractive as Eat & Drink and Stay.

---

## 23. Freedom to improve the concept

You are explicitly authorised to improve this mission while implementing it.

If you discover:

- a better navigation structure
- a better entity taxonomy
- a simpler claiming model
- a stronger security approach
- a more maintainable data architecture
- a better D1 schema
- a better user journey
- missing functionality that is clearly necessary
- unnecessary functionality that adds complexity without value

then change the plan accordingly.

Use engineering judgement.

Do not stop to ask Colin about minor implementation details that can be resolved sensibly from the repository, the existing mission and this document.

Escalate only decisions that materially change the public purpose, create significant ongoing cost, introduce legal risk, or require credentials/information you genuinely cannot obtain.

Otherwise: **make the decision and build it.**

---

## 24. Minimum expected deliverables

The completed mission should leave the repo with, at minimum:

1. A coherent revised site information architecture.
2. Community directory section.
3. Services directory section.
4. Unified or substantially improved entity data model.
5. Migration of existing listings as appropriate.
6. Individual entity/listing presentation that works across entity types.
7. Search/filtering appropriate to the enlarged directory.
8. Add Your Listing workflow.
9. Claim This Listing workflow.
10. Secure maintainer/edit-link or equivalent low-friction management model.
11. Moderation/approval workflow.
12. Verification/status model.
13. Event/contribution linkage to organisations where practical.
14. Appropriate protection for government/official entities.
15. Strong spam/security controls.
16. Responsive and accessible UI.
17. Updated tests/checks where the project has them.
18. Updated project documentation explaining the architecture and operating workflow.
19. Successful production build.
20. No regression of important existing URLs or functionality without deliberate redirect/migration handling.

---

## 25. Acceptance test

The result should pass these human tests:

### Resident

A Mallacoota resident can quickly find a sporting club, social group, community organisation, government service, health service, trade or local business without needing Facebook.

### Organisation

A club secretary who is not technical can add or claim the club, provide accurate contact and meeting information, and later update it without needing Colin to edit JSON by hand.

### Visitor

A visitor still has an excellent Eat / Stay / Do / What's On experience and is not confused by the expanded community scope.

### Maintainer

Colin can operate the system with very little routine work. Spam and dubious submissions are controlled. Legitimate organisations can maintain their own information.

### Technical

The site remains fast, secure, maintainable, Cloudflare-friendly and deployable from the repository.

---

## 26. Final instruction

Treat this as a real product build, not a prototype exercise.

Inspect what is already there. Preserve what works. Refactor what needs refactoring. Improve weak assumptions. Complete the user journeys. Test the result.

Do not simply satisfy the bullet points mechanically.

Build the version of Love Mallacoota that you would want a small, isolated community to rely on every day.

**Make it excellent.**
