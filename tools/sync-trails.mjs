/*
# Project:     lovemallacoota.au
# File Name:   sync-trails.mjs
# Description: Copies the TrailBound trails within a two-hour drive into
#              data/trails-nearby.json, so the weekly feature does not depend on
#              a sibling checkout at build time. Run when TrailBound changes.
#              Usage: node tools/sync-trails.mjs [../trailbound]
*/

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(
  rootDir,
  process.argv[2] || "../trailbound",
  "src/data/trails.json"
);

if (!existsSync(source)) {
  console.error(`No TrailBound data at ${source}`);
  process.exit(1);
}

const MALLACOOTA = { lat: -37.5577, lng: 149.754 };
const RADIUS_KM = 70;

const km = (a, b) => {
  const R = 6371;
  const rad = (v) => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const nearby = JSON.parse(readFileSync(source, "utf8"))
  .filter((trail) => trail.mapStart?.lat && trail.mapStart?.lng)
  .map((trail) => ({ trail, distanceKm: km(MALLACOOTA, trail.mapStart) }))
  .filter(({ distanceKm }) => distanceKm <= RADIUS_KM)
  .sort((a, b) => a.distanceKm - b.distanceKm)
  .map(({ trail, distanceKm }) => ({
    slug: trail.slug,
    name: trail.name,
    region: trail.region,
    state: trail.state,
    distance: trail.distance,
    duration: trail.duration,
    difficulty: trail.difficulty,
    terrain: trail.terrain,
    start: trail.start,
    // TrailBound's highlights is a prose paragraph; about is an array of them.
    summary: trail.highlights || (trail.about || [])[0] || "",
    url: `https://trailbound.au/trails/${trail.slug}`,
    directLineKm: Math.round(distanceKm),
  }));

const out = path.join(rootDir, "data", "trails-nearby.json");
writeFileSync(out, `${JSON.stringify(nearby, null, 2)}\n`);
console.log(`${nearby.length} trails within ${RADIUS_KM} km written to data/trails-nearby.json`);
console.log(nearby.slice(0, 5).map((t) => `  ${t.directLineKm} km  ${t.name}`).join("\n"));
