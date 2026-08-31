# Handover — 31 August 2026, end of day

Live release **v0.70** at [lovemallacoota.au](https://lovemallacoota.au).
Working tree clean, `main` pushed, 121 tests passing.

Two days of work: the navigation and SEO mission on the 30th, and on the 31st a
single small issue — "the form does not send an email" — that turned out to be
five independent faults stacked on top of each other, plus a sixth found while
testing the fix. All are fixed. The full account is in
[`docs/EMAIL.md`](EMAIL.md), written so the next person spends an hour rather
than a day.

---

## The one thing to do first

**Finish a submission end to end.** It has never been done. Everything is now
configured and each link tested individually, but no listing has completed the
whole path.

1. https://lovemallacoota.au/add-listing.html — fill it in with any address
2. The code arrives from `Love Mallacoota <coota@oze.com.au>`
3. **Follow the link in the email**, do not type the address — the `?id=` matters
4. Enter the code, save

Watch it happen:

```sh
npx wrangler tail --env="" --format json
```

If it stops, [`docs/EMAIL.md`](EMAIL.md) has a table mapping every log line to
its cause.

---

## What changed on the 31st

### The mail chain, which had never worked

Verification codes now go to the person who typed the address, through Resend
(`src/mailer.ts`). Messages that belong to Colin still go through the adnet
relay, which is what it is for. Two paths, because the relay deliberately cannot
choose a recipient and Cloudflare Email Routing cannot reach a stranger.

Five faults found and fixed, none of which produced a failing build or an error
anybody would see:

1. **CSP `connect-src` had no `challenges.cloudflare.com`** — Turnstile loaded,
   built its container, and died on the call that starts the challenge. No
   iframe, no token, no error. This was underneath the other four, so fixing the
   secrets first was correct and still looked like no progress.
2. **The honeypot was called `website`**, beside a real `website_url` field. A
   password manager filled it and the submission was discarded as a bot while
   the page said "Check your email for a code".
3. **`RELAY_KEY` was an empty string** on `adnet-serve`. It lists identically to
   a correct one.
4. **`TURNSTILE_SECRET_KEY` came from a different widget** than the site key.
5. **The Email Routing destination was verified on the wrong account** — there
   are four on one login and two are named `Colin@oze.com.au` and
   `Col@oze.com.au`.

And a sixth, found while testing the fix:

6. **`/verify.html?id=…` posted no id.** The page read `Astro.url.searchParams`
   in the frontmatter, and this is a static build, so it shipped `value=""` on
   every copy. The server then blamed the code the person had just typed
   correctly. Confirming a listing had never been possible.

### 3MGB's weekly programme

[This Week](https://lovemallacoota.au/edition.html) now carries the radio
programme: 22 local shows across the seven days, from Radio Waves 2026 V6.
Standing data in `data/radio-program.json`, like the bus timetable — read at
build time, changed when 3MGB publish a new guide, never fetched during a build.

Colin's editorial call: the guide still prints three shows as postponed until
July 2026, July has passed, and they are shown as running. The reason is in the
data file; restoring the `postponed` key puts the strike-through back.

### Tooling that came out of it

- **[`tools/push-secrets.sh`](../tools/push-secrets.sh)** — verifies every secret
  against the service that owns it and refuses to send one that fails. This is
  the direct answer to Worker secrets being write-only.
- **Diagnostic logging** — Turnstile's `error-codes`, a missing token as distinct
  from a rejected one, the relay's status and body, Resend's refusal. Every one
  of these replaced a silent failure.
- **Tests** that guard the classes of bug found: CSP third parties, honeypot
  naming, label targets, build-time query reads, codes addressed to the
  submitter.

---

## Still open

| | |
| --- | --- |
| **Finish a submission end to end** | Never done. See above. |
| **`STRIPE_WEBHOOK_SECRET` not in `.env.secrets`** | It is set in production and working; the local record is incomplete. Add it when convenient. |
| **Rotate two credentials** | An 84-character and a 390-character string went through the shell and out to Cloudflare's siteverify during debugging, and one spent time in the Worker as `TURNSTILE_SECRET_KEY`. If either was a GitHub or Cloudflare token, reissue it. |
| **`allowed_destination_addresses` on the relay** | `serve/wrangler.jsonc` in the adnet repo. Would make a wrong destination fail at deploy rather than at send. |
| **Dead `entity` branches on claim / submit-event** | The build-time lookup was always null, so the branch telling a claimant "we will email the published address" has never rendered. Resolving the listing client-side would make that page considerably better. |
| **Dead `.survey-*` CSS** | ~12 lines with no markup rendering them. Flagged as a background task. |
| **Personal calendar behind What's On** | `/calendar.html` embeds `crdixon@gmail.com`, whose full history is publicly downloadable — it contains a doctor's appointment and two named birthday parties. Move the community events to a dedicated calendar before promoting the page. |
| **No listing has a photograph** | `images/listings/` is empty. The biggest lever on how the site feels to someone arriving from Facebook. |
| **Promotion** | The blockers are the calendar above and the photographs. This Week is the strongest thing to lead with; `docs/outreach/promotional-material.md` has the copy. |

---

## Letters written, none sent

- [`docs/outreach/letter-to-the-college-and-society.md`](outreach/letter-to-the-college-and-society.md)
  — archive permission, printed copies, contributing to This Week, and whether
  the edition could carry the Mouth's name. Addressed to the Principal by role;
  the office would not give the name.
- [`docs/outreach/letter-to-3mgb.md`](outreach/letter-to-3mgb.md) — unsent.
  Nobody at 3MGB has been contacted about the programme now on the site.

---

## Where things are

| | |
| --- | --- |
| Deploy | `gh workflow run deploy.yml -f target=production`. **Never `pnpm run deploy` locally** — it builds without the Turnstile site key from GitHub secrets and ships the always-passes test key. |
| Secrets | `./tools/push-secrets.sh`, from `.env.secrets` (gitignored). |
| Mail | [`docs/EMAIL.md`](EMAIL.md). |
| Release checks | [`docs/DEPLOYMENT.md`](DEPLOYMENT.md). |
| Accounts | Four Cloudflare accounts on one login. `adnet-serve` on `1b494ec3…`, `lovemallacoota` on `ab29454d…`. See EMAIL.md. |
