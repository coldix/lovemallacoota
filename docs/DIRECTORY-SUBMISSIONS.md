# Directory submissions and verification

Letting businesses add and maintain their own listing, with a verification date
shown publicly, and one photo each.

Residents are deliberately not in scope yet. See "Residents, later" at the end.


## Decisions

**S1. Businesses first, residents later.** The submission, verification and
photo pipeline is proven against business listings, which are already public
information. A directory of residents' names, phone numbers and addresses for a
town of a thousand people is a different risk class, and it is not built until
the machinery around it is boring.

**S2. Email is verified; a mobile number is shown as supplied.** A code is
emailed through the adnet relay and must be entered to publish. There is no SMS
product on Cloudflare, and per-message billing through a third party is not
worth it yet, so a mobile number is published as *supplied*, never as
*verified*. The card says which, in those words. Claiming a verification we did
not perform would be worse than having none.

**S3. Every card carries its verification date.** Not a badge, a date: "Email
verified 28 August 2026". A visitor can judge for themselves whether that is
recent enough to trust. This is the strongest claim the directory can make
against visitmallacoota.com.au, and it is only worth anything if it is accurate,
so a date is never written except by an actual verification.

**S4. One photo per listing, 1280px on the longest side, WebP.** Uploaded to R2
staging by the Worker, converted in CI with sharp, committed, and served as a
static asset. No new paid service, and the image ends up in the same build as
everything else. One photo per listing keeps the repository growing slowly.

**S5. Business listings stay in git; resident records will not.** A business
listing is public information and benefits from an open, auditable history.
Personal records do not: git history is permanent, so "please remove me" could
not be honoured. When residents are built, they go in D1, where a delete is a
delete.


## Verification model

```jsonc
"verification": {
  "email": {
    "value": "hello@example.com",
    "verifiedAt": "2026-08-28",        // set only by a completed code exchange
    "method": "emailed-code"
  },
  "mobile": {
    "value": "0427 197 753",
    "verified": false,                  // no SMS provider; see S2
    "note": "Supplied by the business, not verified"
  },
  "lastReviewedAt": "2026-08-28"        // a human last looked at this listing
}
```

Rules the build enforces:

- A `verifiedAt` date may not be in the future.
- A listing with no `verification` block renders as "Not yet verified", never as
  verified.
- `mobile.verified` may not be `true` while there is no SMS verification path.
  If that changes, this document changes first.


## Submission flow

```text
Business owner  →  /add-listing
                     ↓ fills in the form, one photo
                 Worker: Turnstile, rate limit, validate
                     ↓
                 photo → R2 staging (original, unconverted)
                     ↓
                 code emailed to the address given, via the adnet relay
                     ↓ code entered
                 verified: commit listing JSON + queue the photo
                     ↓
                 CI: sharp → 1280px WebP → commit → deploy
                     ↓ ~2 minutes
                 live, showing "Email verified <date>"
```

An unverified submission is never published. A submission whose code is never
entered expires and the staged photo is deleted.


## Claiming and correcting

A listing already in the directory can be claimed by whoever can receive email
at the address published on it, which is the same code exchange. After that the
owner can update it or ask for removal. Every change is a commit, so the history
of a listing is visible.


## Build slices

1. **The verification date on the card, and the photo slot.** Data model,
   rendering, and the rules above enforced by tests. Nothing submits yet, so
   dates only appear where a verification actually happened.
2. **The submission form and the code exchange.** Needs the relay working.
3. **The photo pipeline.** R2 staging bucket, the CI conversion step.
4. **Claim and correct** on existing listings.


## Residents, later

When it is built: Cloudflare Access so only signed-in locals can search it, D1
so records can be deleted, no bulk export, no enumerable listing, and a
self-service removal that works without asking anyone. Anyone can be findable
for a reason they did not anticipate — someone who has left a violent
relationship, for instance — so the default is not listed, and removal must be
immediate and unconditional.
