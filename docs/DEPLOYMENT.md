# Cloudflare deployment

The canonical production site is `https://lovemallacoota.au`.

**Release:** `v0.07`, authorised for production deployment on 28 August 2026.

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

## Rollback

Use `wrangler versions list` followed by `wrangler rollback` to restore a previous
Worker version. DNS can also be returned to Hostinger while the old hosting account
is retained during the cutover window.
