# Cloudflare deployment

The canonical production site is `https://lovemallacoota.au`.

**Release:** `v0.07`, deployed to production on 28 August 2026.

The production Worker is attached as a Cloudflare Custom Domain to both
`lovemallacoota.au` and `www.lovemallacoota.au`. Authoritative DNS and the live
Worker were verified after deployment; recursive resolver caches may take a short
time to observe newly created records.

The Worker serves an explicit static build from `dist/`, redirects the `www` host,
and preserves the old WordPress redirects previously defined in `.htaccess`.
Legacy `.com.au` and `.com` redirect logic is ready in the Worker but those hostnames
cannot be attached until their zones are present in the same Cloudflare account.

Pushes to `main` deploy only the isolated preview Worker. Production deployment is
manual through the GitHub Actions **Run workflow** control with `production` selected,
or through the explicit local production command below.

## Prerequisites

- `lovemallacoota.au` must be an active zone in the configured Cloudflare account.
- The production Worker uses Custom Domains for the apex and `www` host, allowing
  Cloudflare to create their DNS records and certificates.
- `lovemallacoota.au` must use both assigned nameservers:
  `dilbert.ns.cloudflare.com` and `jewel.ns.cloudflare.com`.
- Copy the existing Hostinger MX, SPF, verification, and any DKIM/DMARC records into
  Cloudflare before changing nameservers for `.com.au` or `.com`.
- Add a GitHub Actions secret named `CLOUDFLARE_API_TOKEN` with the least privileges
  needed to deploy this Worker and manage routes for these zones.

## Local validation

```sh
pnpm install
pnpm run check
pnpm run dev
```

The static build is intentionally allow-listed in `tools/build-static.mjs`. Source,
repository metadata, the mission document, and archive PDFs are not deployed.

## Manual deployment

```sh
pnpm run deploy:preview
```

The preview command deploys a separate `lovemallacoota-preview` Worker with a
`workers.dev` address and no custom-domain routes. After that preview is verified,
deploy production with:

```sh
pnpm run deploy
```

Wrangler must be authenticated to the Cloudflare account that owns the zones.

## Cutover order

1. Deploy and test the generated `workers.dev` preview URL.
2. Confirm all canonical pages, assets, JSON files, redirects, and the 404 response.
3. Activate the `lovemallacoota.au` Worker Custom Domains.
4. Move `.com.au` and `.com` to Cloudflare only after their email DNS records exist.
5. After the legacy zones are added, attach their routes and verify they return a
   single 301 to the matching `.au` URL.
6. Keep the Hostinger files unchanged for seven days as a rollback source.
7. Add all domain variants to Search Console and submit the `.au` sitemap.

## Release verification

After a production deployment, verify the home page, directory, archive,
emergency page and sitemap on the canonical domain. Confirm that every legacy
hostname returns one permanent redirect that keeps the complete path and query
string. Record the deployed version and rollback version before changing any
remaining DNS records.

### Verify the forms, because nothing else will

The pages are static and fail loudly. The forms are not, and every one of them
failed silently from launch until 31 August 2026 without a single failing build
or test. Check them deliberately after any change to the CSP, the secrets, or
the Turnstile widget.

Submit the add-listing form and follow it to the end: a code by email, the code
accepted at `/verify.html`, the listing saved. That single path exercises
Turnstile, D1, the mail relay and the GitHub token in order — the four things
that can be independently broken.

Watch it happen rather than guessing:

```sh
npx wrangler tail --env="" --format json      # this Worker
cd ~/web/adnet && npx wrangler tail --config serve/wrangler.jsonc   # the mail relay
```

What the messages mean:

| Log line | Cause |
| --- | --- |
| `no turnstile token in the submission` | The widget never ran. Check `connect-src` in the CSP, and the widget's hostname list. |
| `turnstile rejected ["invalid-input-secret"]` | The secret is not the partner of the site key on the page. |
| `turnstile rejected ["timeout-or-duplicate"]` | A stale page or a resubmitted token. Reload. |
| `relay rejected the mail 401` | `RELAY_KEY` differs between this Worker and `adnet-serve`. |
| `relay rejected the mail 503` | `RELAY_KEY` is unset or empty on `adnet-serve`. |
| `relay rejected the mail 502 Send failed` | The keys match; Cloudflare Email Sending refused. Verify the destination in Email Routing **on the relay's own account**, `1b494ec3…`, not the site's. |
| `mailer refused the message 403 … domain is not verified` | The `MAIL_FROM` domain is not verified at resend.com/domains. It must be `oze.com.au`. |
| `mailer is not configured` | `RESEND_API_KEY` or `MAIL_FROM` is missing; submissions are refused up front. |
| `honeypot tripped` | Something filled `lm_leave_blank` — usually a password manager. The submission was discarded. |
| `Enter the six-digit code` when the code is right | The verification link lost its `?id=`. |
| `Cannot write …: 401` | `GITHUB_TOKEN` is wrong, expired, or lacks Contents: read and write. |

[`docs/EMAIL.md`](EMAIL.md) explains each of these and carries checks that
diagnose a secret without sending anything.

Verify the secrets themselves without deploying anything:

```sh
./tools/push-secrets.sh --check
```

A Worker secret takes effect immediately and needs no deploy. The Turnstile
**site** key does need one, because the pages bake it in at build time. Setting
any secret creates a new Worker version, which ends an attached `wrangler tail`
— restart it before testing.

## Rollback

Use `wrangler versions list` followed by `wrangler rollback` to restore a previous
Worker version. DNS can also be returned to Hostinger while the old hosting account
is retained during the cutover window.
