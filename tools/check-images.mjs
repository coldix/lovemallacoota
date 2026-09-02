/*
# Project:     lovemallacoota.au
# File Name:   check-images.mjs
# Description: Reports listing images that the data references but the
#              repository does not hold. Missing files are left out of the
#              rendered JSON-LD, so this is a work list, not a build failure.
#              With --gaps it lists the listings that have no photograph at all,
#              which is the larger problem: most of the directory is text.
#              Run: pnpm run check:images [--gaps]
*/

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_LISTING_FILES, referencedImages } from "../src/lib/listings.mjs";
import { canClaim, listingPhoto, loadDirectory } from "../src/lib/directory.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const referenced = referencedImages(ALL_LISTING_FILES);
const missing = referenced.filter(
  ({ url }) => !existsSync(path.join(rootDir, url.replace(/^\//, "")))
);

console.log(`Listing images referenced: ${referenced.length}`);
console.log(`Present in the repository: ${referenced.length - missing.length}`);
console.log(`Missing: ${missing.length}`);

if (missing.length) {
  console.log("\nThese are referenced by the data but are not in the repository.");
  console.log("They are omitted from the structured data until the files are added.\n");
  for (const { business, url } of missing) {
    console.log(`  ${url}  (${business})`);
  }
  console.log("\nAdd the files, then add their directory to publicDirectories in tools/public-files.mjs.");
}

// --- What has no photograph at all --------------------------------------
// A listing shows a picture if images/listings/<slug>.webp exists, or if its
// data names a file that does. The first needs no data edit at all: save the
// photograph under that name and it appears.
if (process.argv.includes("--gaps")) {
  const entities = loadDirectory();
  const withPhoto = entities.filter((entity) => listingPhoto(entity));
  const gaps = entities.filter((entity) => !listingPhoto(entity));

  console.log(`\nListings with a photograph: ${withPhoto.length} of ${entities.length}`);

  const bySection = new Map();
  for (const entity of gaps) {
    const section = entity.section || "other";
    if (!bySection.has(section)) bySection.set(section, []);
    bySection.get(section).push(entity);
  }

  for (const section of [...bySection.keys()].sort()) {
    const listings = bySection.get(section);
    console.log(`\n${section} - ${listings.length} without a photograph`);
    for (const entity of listings.sort((a, b) => a.name.localeCompare(b.name))) {
      // A claimable listing can be photographed by its owner; an official one
      // never will be, so those are Colin's to take or to leave.
      const who = canClaim(entity) ? "owner or Colin" : "Colin only";
      console.log(`  images/listings/${entity.slug}.webp  ${entity.name} (${who})`);
    }
  }
}
