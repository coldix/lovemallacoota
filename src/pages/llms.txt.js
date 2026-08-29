/*
# Project:     lovemallacoota.au
# File Name:   llms.txt.js
# Description: The guide for AI crawlers, generated so it cannot fall behind
#              the site. The hand-written file it replaces knew nothing about
#              the weekly edition or Local of the Week.
*/

import { currentEdition, editionLabel, loadEditions, localsOfTheWeek } from "../lib/editions.mjs";
import { archiveIssues, loadArchive } from "../lib/archive.mjs";
import { ALL_LISTING_FILES, loadListings } from "../lib/listings.mjs";

export function GET() {
  const archive = loadArchive();
  const issues = archiveIssues(archive);
  const edition = currentEdition();
  const locals = localsOfTheWeek();
  const listings = loadListings(ALL_LISTING_FILES);
  const editions = loadEditions();

  const body = `# Love Mallacoota

> Local guide, weekly community edition and historical archive for Mallacoota,
> Victoria, Australia (East Gippsland, postcode 3892). ${listings.length} verified-by-hand
> business listings, a weekly edition of community news, and a catalogue of
> ${issues.length} issues of the local newspaper. Run by Colin Dixon (oze.au).

Mallacoota is a coastal town at the Mallacoota Inlet, roughly 520 km east of
Melbourne and 550 km south of Sydney, bordered by Croajingolong National Park.

## The weekly edition

${edition ? `Current: ${editionLabel(edition)}, published at https://lovemallacoota.au/edition.html
Every week keeps a permanent page at /edition/<year>-w<week>.html and a printable
PDF at /edition/<year>-w<week>.pdf. ${editions.length} edition(s) so far.` : "No edition is open."}

Sections are contributed by the people and groups they belong to, with the
forecast, tides, transport, a walk and a business compiled automatically.

## Directory

- [Eat & Drink](https://lovemallacoota.au/food.html): cafes, restaurants, pubs, takeaway, seafood
- [Stay](https://lovemallacoota.au/accom.html): lodges, motels, holiday houses, caravan parks
- [Do & See](https://lovemallacoota.au/activity.html): boat hire, tours, galleries, shops, attractions

Each listing carries its verification state and the date it was checked. A
listing marked "Not yet verified" has not been confirmed by us.

## People and history

- [Local of the Week](https://lovemallacoota.au/locals.html): ${locals.length} profile(s) of Mallacoota people
- [Mallacoota Mouth archive](https://lovemallacoota.au/archive.html): ${issues.length} issues catalogued, ${issues.at(-1)?.publicationDate.slice(0, 4)}–${issues[0]?.publicationDate.slice(0, 4)}

The archive publishes catalogue metadata only. No PDF is republished: the
issues remain in copyright and permission has not yet been recorded.

## Machine-readable data

- https://lovemallacoota.au/data/listings_food.json
- https://lovemallacoota.au/data/listings_accom.json
- https://lovemallacoota.au/data/listings_do.json
- https://lovemallacoota.au/data/archive-index.json
- https://lovemallacoota.au/data/bus-timetable.json — coach times from the PTV open feed
- https://lovemallacoota.au/data/site-version.json — build version and checksums

## Using this content

Content is CC BY 4.0 unless marked otherwise; see
https://lovemallacoota.au/terms.html. Attribute to Love Mallacoota with a link.
Photographs and archived newspaper material are licensed separately and are not
covered by that grant.

Emergency information is relayed from official sources only. This site is not
an emergency authority: https://lovemallacoota.au/emergency.html
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
