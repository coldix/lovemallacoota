# Love Mallacoota

Community information platform and local guide for
[lovemallacoota.au](https://lovemallacoota.au/). The current release combines
Mallacoota food, accommodation, activities, events, maps, and community links
while the broader communications platform is built out.

The project mission is documented in [`docs/MISSION.md`](docs/MISSION.md).

## Current release

Release `v0.07` is the first Astro and Cloudflare Workers release. It preserves
the established public URLs, adds the Mallacoota Mouth catalogue and community
information policies, and separates preview deployments from deliberate
production releases. It was deployed to `lovemallacoota.au` on 28 August 2026.

## Structure

- `src/pages/` contains the Astro routes. `build.format: "file"` keeps the existing `.html` public URLs working.
- `src/components/` and `src/layouts/` contain shared navigation, footer, metadata, hero, and directory UI.
- `assets/css/` contains shared styles.
- `assets/js/` contains shared browser scripts.
- `assets/icons/` contains web app and favicon assets, except `favicon.ico`, which remains at the root for browser compatibility.
- `images/` contains site imagery and logos.
- `data/` contains listing JSON and generated site version metadata.
- `src/worker.ts` handles canonical-host, legacy-domain, and old-path redirects.
- `tools/` copies allow-listed legacy assets into the Astro build and maintains release metadata.
- `docs/` contains the mission, Codex rebuild plan, deployment runbook, and private working references;
  it is not included in the public build.

## Local development

```sh
pnpm install
pnpm run check
pnpm run dev
```

The site is served locally at `http://localhost:8787`. Build output is written to
`dist/` from the explicit public-file allow-list in `tools/public-files.mjs`.

## Deployment

Production is deployed as Cloudflare Worker Static Assets. The canonical domain is
`lovemallacoota.au`; its `www` hostname redirects to the apex. Redirect handling
for the `.com.au` and `.com` names is implemented and can be activated after those
zones are added to the same Cloudflare account.

Pushes to `main` deploy the isolated preview Worker. Production deployment must
be selected manually in GitHub Actions or run explicitly by an authenticated
maintainer.

```sh
pnpm run deploy
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for DNS, email-record preservation,
cutover, and rollback instructions.

## Versioning

Run this before publishing content changes:

```sh
pnpm run version:site
```

The script writes `data/site-version.json` using only public site files, with:

- a simple release version, starting at `v0.01`
- a generated date and time in Australia/Melbourne time
- a SHA-256 record for each site file

Normal updates increment by `.01`, for example `v0.01`, `v0.02`, `v0.03`.
For a major release, run:

```sh
node tools/update-version.mjs --major
```

To seed or correct a version manually, run:

```sh
node tools/update-version.mjs --set=v0.01
```

The footer reads this manifest and displays the current version automatically.

## GitHub

The expected remote is:

```sh
origin https://github.com/coldix/lovemallacoota.git
```

Before publishing, check:

```sh
git status
git diff --stat
```
