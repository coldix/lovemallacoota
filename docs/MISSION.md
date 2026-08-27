MISSION.md
Love Mallacoota — Community Communications Platform






	Version
	v0.01
	Created
	27/08/2026 22:21 AEST
	Last updated
	27/08/2026 22:21 AEST
	Status
	Draft for comment
	Repository
	https://github.com/coldix/lovemallacoota
	Site
	https://lovemallacoota.au
	Licence
	Code: MIT. Content: see Section 9.


________________


1. Why this exists
The Mallacoota Mouth has closed. With it went the one place where a person could find out what was on, who was doing what, and what had happened, without joining a Facebook group or knowing the right person.
I made this calendar, it will be out of date now..
https://calendar.google.com/calendar/u/0?cid=Y3JkaXhvbkBnbWFpbC5jb20




Mallacoota is a small town at the end of a long road. Reliable local information is not a nice extra here. It is how a community that is often cut off by fire, flood or distance stays connected to itself.


MADRA, with support from Australian Business Volunteers, is currently asking the community what should replace it. That consultation is welcome and should shape what gets built.


This project does not wait for permission to start. It builds something useful, gives it away, and lets the community decide whether to adopt it.
2. What we are building
A free, open, well built local information platform for Mallacoota and district, at lovemallacoota.au.


It carries:


* What's On, events and a community calendar
* Notices from community groups, clubs and services
* Local business and service directory
* School, youth and sport activity
* Local history, including an archive of past publications
* Visitor and trail information, linked to trailbound.au
* Relayed emergency and official information, under the rules in Section 6


It is delivered as a website first, with an email digest and social distribution built on top of the same content.
3. Principles
Build it, then offer it. Committees discuss. We ship. A working thing that people can look at beats a proposal every time.


Free to the community, forever. No fee to be listed. No fee to submit a notice. No fee to read. No paywall, ever.


Open by default. The code lives on GitHub in public. Anyone can read it, fork it, audit it or take it over. Nothing about how this works is a secret.


Be the best, not the loudest. There is competing tourism infrastructure in this town and there is friction. We do not answer it. We answer it by being faster, more accurate, better looking and more useful. Quality is the whole argument.


Nobody is required to like us. There will be critics. Some criticism will be fair and will improve the platform. Some will not be. Neither changes the work.


Low effort to run. The Mouth did not close because publishing is hard. It closed because sustained volunteer effort is hard. Anything that needs more than a couple of hours a week from one person will go quiet within a year. Design accordingly: submission forms not logins, scheduled publishing, automatic digests, no daily obligation. ( I dont see there will be anyone coming fwd, unless paid to do so)


Official sources come first. On anything that matters for safety, we point at the authority and say so plainly. This is the same rule trailbound.au already runs on.


Own your own front door. The platform is not built on a rented pulpit. Facebook groups, YouTube and Substack are distribution. The site is the record.
4. What this is not
* Not a newspaper. No investigative reporting, no editorials, no taking sides in local disputes.
* Not a replacement for official emergency services communication.
* Not a competitor to any community group. It is a shelf they can put things on.
* Not a paid service, at any tier, for community content.
* Not a Facebook group. Comment threads are not the product. ( buy we may run a substack type part inviting comments)
5. Editorial policy
What we publish: factual local information supplied by the person or group it belongs to. Events, notices, updates, directory listings, history.


What we do not publish: personal attacks, political campaigning, unverified claims about named people or businesses, and anything a reasonable person would read as taking sides in a local dispute.
Although we will campaign for better local services, funding and autonomy, and call out waste.. Just facts.



Corrections: errors are fixed quickly and visibly, with the correction noted and dated, and kept in the repro with reasons.


Right of reply: any group or business that believes their listing or a notice about them is wrong can have it corrected or removed. No argument required.


Submissions: open to everyone. Everything is checked before it goes live. Rejection reasons are given in writing.
6. Emergency and safety information
This is the highest risk part of the platform and it gets its own rules.


1. We relay only. We never write original emergency advice.
2. Every emergency item carries a visible timestamp and a direct link to the issuing authority: VicEmergency, CFA, Parks Victoria, East Gippsland Shire Council, BOM.
3. Every emergency page carries a permanent, prominent line: In an emergency call 000. VicEmergency is the official source. This page may be out of date.
4. If we cannot keep a relay current, we take it down and link out instead. A stale emergency page is worse than no page.
5. We do not aggregate emergency information from social media.
7. Relationship with the rest of the network
* lovemallacoota.au is the community and local information platform. This document governs it.
* trailbound.au is the map first trail guide for East Gippsland and the far south coast. Love Mallacoota links to it for walks and trips. It links back for town services. Neither absorbs the other.
* coota.au is held as a community hub domain and can be pointed here or run alongside.
* Other oze.au network properties may share components and infrastructure but keep their own identity.


Mallacoota is a tourist town. Visitor content and community content are not in conflict here. A person looking for the tide, the bakery hours, the market date and the walk to the lighthouse is often the same person, whether they live here or arrived yesterday.
8. Technology
* Static first. Fast on a bad connection, because plenty of connections here are bad.
* Hosted on Cloudflare Workers with static assets, behind Cloudflare DNS and CDN.
* Content in structured JSON and D1, so it can be re published as a website, an email digest, a feed or an app without rewriting it.
* Forms and submissions handled by Workers, with Turnstile for spam.
* Images and archive PDFs in R2.
* Everything in the public GitHub repository, deployed by GitHub Actions on push.
* Versioned on every content release via tools/update-version.mjs, with the version visible in the footer.
* Accessible: WCAG 2.1 AA as the target, because a real share of this town is over 65.


There is no vendor lock. If the community takes this over tomorrow, they get the repository, the data and the deployment pipeline, and they can move it anywhere.
9. Funding and open source
The problem to solve: the platform must cost the community nothing and must not depend indefinitely on one person paying for it.


The model:


* Hosting and infrastructure run inside Cloudflare's free tier at this town's traffic levels. Baseline running cost is close to zero.
* Revenue comes from advertising and sponsored placement, sold to businesses that want reach, not charged to community groups that need a noticeboard.
* Advertising is clearly labelled, never mixed into community notices, never dressed up as editorial, and never placed on emergency pages.
* Community content is never behind, beside or dependent on a payment.


Contributor revenue share:


Contributors who materially build or maintain the platform can share in advertising revenue. This is offered in good faith, and it needs to be written down properly before any money moves, because informal splits are how volunteer projects end in bad blood.


Before the first dollar is shared:


* A written contributor agreement setting out what counts as a contribution, how the share is calculated, and how it ends.
* A decision on the legal and tax structure. Sole trader, incorporated association or something else. Ad revenue paid to individuals is assessable income and this needs to be right from the start.
* Public, transparent reporting of revenue and splits in the repository.


Until that is in place, contributions are volunteer contributions and are acknowledged as such.


Code licence: MIT. Take it, fork it, run your own.


Content licence: original platform content under Creative Commons BY 4.0. Content submitted by community groups and businesses stays theirs, licensed to us to publish. Archived third party material such as past issues of The Mallacoota Mouth is published only with the copyright holder's permission and under whatever terms they set.
10. Governance and handover
The platform is currently built and maintained by Colin Dixon under the oze.au network.


It is offered to the Mallacoota community free of charge. If MADRA, or any successor community body, wants to adopt it, the offer is: The domain namse are owned by Colin Dixon



* The repository, the data, the domain and the deployment pipeline.
* Assistance with the handover.
* No fee, no ongoing claim, no conditions beyond the emergency information rules in Section 6 and the free to community rule in Section 9.


Until anyone takes that up, decisions rest with the maintainer, made in public in the repository.


If the project ever ends, the archive and the data are released publicly so nothing that the community put in is lost.
11. What success looks like
By end of 2026:


* Community calendar live, populated, and used by at least six local groups
* Business and service directory current and complete
* Submission process working with no maintainer chasing required
* Weekly or fortnightly email digest going out automatically
* The Mallacoota Mouth archive online and searchable, with permission
* A written offer of the platform delivered to MADRA


Ongoing measures:


* Number of active contributing groups, and page views
* Time from submission to publication
* How long the maintainer actually spends per week. If it climbs, the design is wrong.
* Whether the thing survives a month of the maintainer being unavailable
12. Open questions
These are not settled and are recorded honestly rather than glossed over.


* Copyright holder and permission status for The Mallacoota Mouth archive.
* Whether the platform sits under lovemallacoota.au permanently or moves to a neutral community domain if adopted.
* Whether advertising can realistically fund this in a town of this size, or whether it stays a near zero cost volunteer project with ads as a small offset. Perhaps a Subscriber model?
$5 per month $50 pa, free for 12 months to see if this works.. Or Justa a Donate button..
The site could run go fund me type promos for worthy causes..
* How to handle moderation if submission volume ever exceeds one person's capacity.
@mallacootanow the facebook group has 1,000’s of users and only needs moderatng less than 1 per month, so artildes can go straight up from approbed contrributors..

* What the MADRA survey comes back with, and how that changes scope.


________________


Change log
Version
	Date and time (AEST)
	Change
	v0.01
	27/08/2026 22:21
	Initial draft