# Email — how it works, and every way it broke

Written 31 August 2026, after a day in which no form on this site had ever
worked and nobody knew. Five independent faults, stacked, none of which produced
a failing build, a failing test, or an error anybody would see. This document
exists so the next person spends an hour on it rather than a day.

Read the last section first if something is broken right now.

---

## Two paths, and why there have to be two

There are two kinds of message, and they cannot use the same road.

| | To Colin | To a stranger |
| --- | --- | --- |
| **Examples** | contact form, claim needing review, an event for the calendar | verification codes for add-listing, claim, submit-event |
| **Goes via** | the adnet relay at `ads.oze.net.au/relay` | Resend, direct |
| **Code** | `sendMail()` in `src/listing.ts`, `src/contact.ts` | `src/mailer.ts` |
| **Recipient chosen by** | the relay, from a fixed table | the person filling the form |

The relay **cannot choose a recipient**, deliberately. The caller names a site,
the relay resolves it to one address in `TARGETS` (`serve/src/relay.ts` in the
adnet repo). That is what makes a leaked relay key harmless: the worst it can do
is send noise to an inbox we already own.

That is also why it cannot carry verification codes. It sends through Cloudflare
Email Routing, which **only delivers to addresses verified on that account**. A
member of the public is not verified and never will be. Before `src/mailer.ts`
existed, every confirmation code went to the site's own inbox, and no member of
the public could ever have completed a listing, a claim or an event.

Do not "fix" this by widening the relay. Both halves of the design are correct.

---

## The chain, in order

A person adds a listing. Every one of these can fail independently, and every
one of them did.

1. **Turnstile renders** — needs `challenges.cloudflare.com` in the CSP's
   `script-src`, `frame-src` **and** `connect-src`.
2. **Turnstile verifies** — `TURNSTILE_SECRET_KEY` must be the partner of the
   site key on the page, from the same widget.
3. **Honeypot not tripped** — the trap field is `lm_leave_blank`. If it has a
   value the submission is silently discarded.
4. **D1 write** — `submissions` and `codes`.
5. **Photo staged** (optional) — `GITHUB_TOKEN`, `Contents: read and write`.
6. **Code emailed** — Resend, `RESEND_API_KEY` + `MAIL_FROM` on a verified domain.
7. **Code entered** at `/verify.html?id=…` — the id must survive into the form.
8. **Listing committed** — `GITHUB_TOKEN` again.

---

## Configuration, and where each piece lives

**Four Cloudflare accounts share one login.** Two have almost the same name.
This cost hours.

| Account | ID | Holds |
| --- | --- | --- |
| `Colin@oze.com.au's Account` | `1b494ec3…` | **`adnet-serve`**, `ads.oze.net.au`, the Email Routing destinations the relay sends to |
| `Col@oze.com.au's Account` | `ab29454d…` | **`lovemallacoota`**, the `lovemallacoota.au` zone |
| `col@dixon.net.au` | `b340df1d…` | — |
| `Ss@oze.com.au's Account` | `fe8b3e9f…` | — |

**Col**in versus **Col**. Check `wrangler whoami` before believing you are in
the right place, and confirm the account by what it contains: the relay account
has `adnet-serve` under Workers, the site account has `lovemallacoota`.

Other facts worth not rediscovering:

- **`oze.com.au` DNS is at Hostinger**, not Cloudflare. `ns1.dns-parking.com`.
- **`oze.com.au` is the domain verified with Resend.** It is the sending domain.
- **`lovemallacoota.au` is a Google Workspace alias onto it**, not a sending
  domain. Resend refuses a `From` on it.
- **`coota@oze.com.au` is the Google Workspace mailbox Colin reads.**
  `coota@lovemallacoota.au` is an alias onto the same mailbox, but the relay
  points at the account address so nothing depends on alias resolution.
- Secrets are set with [`tools/push-secrets.sh`](../tools/push-secrets.sh),
  which verifies each against the service that owns it before sending. See
  [`.env.secrets.template`](../.env.secrets.template).

---

## Every fault we hit, and what it looked like

Ordered by how deep it was buried. Each was hidden by the one above it.

### 1. Turnstile died silently — CSP `connect-src`

**Symptom:** form submits, "Verification failed", widget looked fine or never
appeared. Worker logged nothing.

`challenges.cloudflare.com` was in `script-src` and `frame-src` but **not
`connect-src`**. Turnstile loaded, built its container and hidden input, then
made the call that starts the challenge — refused by the policy. No iframe, no
token, no error callback, no console message.

Measured on the live page: script loaded, container present, **zero challenge
iframes**, and an explicit `turnstile.render()` with an `error-callback`
returning nothing at all in twelve seconds.

**This is why every form on the site failed from launch.** A CSP omission
produces no error, no failing build and no log; the only symptom is a feature
that quietly does nothing. A test now asserts every third party the pages load
appears in the directive that governs it.

### 2. The honeypot caught the person filling in the form

**Symptom:** "Check your email for a code", `200` in 2ms, nothing in D1, no
email. A **false success** — worse than an error, because there is nothing to
report and nothing to retry.

The trap field was called `website` and sat beside a real `website_url` field. A
password manager filled it. The real field's `<label for="website">` also
pointed at the honeypot's id, so clicking "Website" focused the hidden trap.

Now `lm_leave_blank`, with `data-1p-ignore` and `data-lpignore`, and tripping it
is logged. A test forbids naming the honeypot anything autofill recognises.

**Tell-tale:** a `200` with `wallTime` in single-digit milliseconds did no work.
A real submission takes seconds.

### 3. `RELAY_KEY` was an empty string on `adnet-serve`

**Symptom:** relay answered `503 {"error":"Relay is not configured."}` to
everything.

`wrangler secret list` showed `RELAY_KEY` present. **An empty secret lists
exactly like a correct one.** The interactive `wrangler secret put` prompt had
captured nothing — the value pasted into it never registered, and the prompt
shows no asterisks to tell you.

**Never trust `secret list`.** It tells you a name exists, nothing more.

### 4. `TURNSTILE_SECRET_KEY` came from a different widget

**Symptom:** widget goes green, server refuses. `turnstile rejected
["invalid-input-secret"]`.

The site key and the secret key are a matched pair and must come from the **same
widget**. Take both from one widget's Settings page in one visit.

### 5. `GITHUB_TOKEN` was rejected

**Symptom:** `Cannot write uploads/…: 401`. Surfaced only because a photograph
upload happened to log it; the listing commit would have failed the same way in
silence.

Needs `Contents: Read and write` on `coldix/lovemallacoota`. **Tokens expire** —
put the date in your calendar, because when it lapses submissions fail with a
401 nobody sees.

### 6. The destination address was not verified — on the account that mattered

**Symptom:** `relay send failed: Error: destination address is not a verified
address`.

Cloudflare's `send_email` binding only delivers to a **verified destination
address**. The address was verified — on `Col@oze.com.au's Account`, while the
Worker doing the sending lives on `Colin@oze.com.au's Account`. Destination
addresses are account-scoped. The dashboard even says so, and it still catches
you, because the two accounts are named almost identically.

### 7. Resend refused the sending domain

**Symptom:** `403 The lovemallacoota.au domain is not verified.`

Then, after switching: `403 The oze.com.au domain is not verified.` — because at
that point **no** domain was verified. Creating an API key does not verify a
domain; that is a separate step with DNS records.

`lovemallacoota.au` will never work as a `From`: it is a Workspace alias, not a
sending domain. `oze.com.au` is the sending domain.

### 8. The verification link lost its id

**Symptom:** the code arrives, you type it, and the page says "Enter the
six-digit code" as though you had mistyped.

```javascript
const id = Astro.url.searchParams.get("id") || "";   // WRONG on a static build
```

This is a **static build**. `Astro.url` is the URL at build time, which has no
query string, so every copy of `verify.html` shipped with `value=""`. The server
saw no id and blamed the code.

Read query parameters from `location.search` in the browser. A test now forbids
`Astro.url.searchParams` in these pages.

---

## Diagnosing it next time

**Watch it happen. Do not guess.**

```sh
npx wrangler tail --env="" --format json                            # the site
cd ~/web/adnet && npx wrangler tail --config serve/wrangler.jsonc   # the relay
```

Setting any secret deploys a new Worker version and **ends an attached tail** —
restart it before testing.

| What you see | What it means |
| --- | --- |
| `200`, `wallTime` under ~10ms, nothing in D1 | The honeypot was tripped. Something filled `lm_leave_blank`. |
| `no turnstile token in the submission` | The widget never ran. Check CSP `connect-src`, then the widget's hostname list. |
| `turnstile rejected ["invalid-input-secret"]` | Secret is not the partner of the site key on the page. |
| `turnstile rejected ["timeout-or-duplicate"]` | Stale page or a resubmitted token. Reload. |
| `relay rejected the mail 401` | `RELAY_KEY` differs between the two Workers. |
| `relay rejected the mail 503` | `RELAY_KEY` unset or empty on `adnet-serve`. |
| `relay send failed: destination address is not a verified address` | Verify it in Email Routing **on the relay's account**, `1b494ec3…`. |
| `mailer refused the message 403 … domain is not verified` | Verify the `MAIL_FROM` domain at resend.com/domains. |
| `mailer is not configured` | `RESEND_API_KEY` or `MAIL_FROM` missing. |
| `Cannot write …: 401` | `GITHUB_TOKEN` wrong, expired, or lacking Contents: write. |
| `Enter the six-digit code` when the code is right | The link lost its `?id=`. |

### Checks that send nothing

Verify every secret against the service that owns it:

```sh
./tools/push-secrets.sh --check
```

Is the relay armed? A wrong bearer should give **401**, not 503:

```sh
curl -s -X POST https://ads.oze.net.au/relay -H 'Authorization: Bearer wrong' \
  -H 'Content-Type: application/json' -d '{"site":"lovemallacoota"}'
```

Is a Turnstile secret real? A valid one answers `invalid-input-response`; a
wrong one `invalid-input-secret`:

```sh
curl -s -X POST https://challenges.cloudflare.com/turnstile/v0/siteverify \
  -F "secret=$(pbpaste | tr -d '\n')" -F "response=XXXX.DUMMY.TOKEN.XXXX"
```

Is a Resend sending domain verified? Offer it with a malformed recipient —
nothing is sent. If it complains about the **address**, the domain is fine; if it
complains about the **domain**, it is not:

```sh
curl -s -X POST https://api.resend.com/emails -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"from":"Love Mallacoota <coota@oze.com.au>","to":["not-an-address"],"subject":"x","text":"x"}'
```

---

## The lesson worth keeping

**Cloudflare Worker secrets are write-only.** Nothing reads one back, so a
correct value, a wrong value and an empty string are indistinguishable by
inspection. Three of the day's faults were values that looked set and were not.

Everything else follows from that: verify each secret against the service that
owns it before sending it, log *why* something was refused rather than that it
was, and exercise the whole chain deliberately after any change — because the
static pages fail loudly and the forms do not.
