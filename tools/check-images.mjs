/*
# Project:     lovemallacoota.au
# File Name:   check-images.mjs
# Description: Reports listing images that the data references but the
#              repository does not hold. Missing files are left out of the
#              rendered JSON-LD, so this is a work list, not a build failure.
#              Run: pnpm run check:images
*/

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_LISTING_FILES, referencedImages } from "../src/lib/listings.mjs";

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
