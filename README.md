# Love Mallacoota

Simple static website for [lovemallacoota.com.au](https://lovemallacoota.com.au/), a local guide to Mallacoota food, accommodation, activities, events, maps, and community links.

## Structure

- `index.html` and the other root `.html` files are public routes and stay in the root so existing links keep working.
- `assets/css/` contains shared styles.
- `assets/js/` contains shared browser scripts.
- `assets/icons/` contains web app and favicon assets, except `favicon.ico`, which remains at the root for browser compatibility.
- `images/` contains site imagery and logos.
- `data/` contains listing JSON and generated site version metadata.
- `tools/` contains maintenance scripts.

## Versioning

Run this before publishing content changes:

```sh
node tools/update-version.mjs
```

The script writes `data/site-version.json` with:

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
