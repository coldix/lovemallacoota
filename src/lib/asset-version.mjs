/*
# Project:     lovemallacoota.au
# File Name:   asset-version.mjs
# Description: The ?v= on the stylesheet and the scripts, taken from what is in
#              them rather than from a number somebody has to remember to change.
#
# The literal it replaces was written out three times and had not moved in
# months. Editing the stylesheet without also editing all three left every
# returning visitor on the cached copy — a navigation change nobody would see,
# and no error anywhere to say why.
*/

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = [
  process.cwd(),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
].find((candidate) => existsSync(path.join(candidate, "assets")));

const cache = new Map();

/**
 * A site-root path with a content hash on it. Eight hex characters is ample for
 * cache busting, where the only requirement is that a change produces a
 * different string.
 */
export function versioned(assetPath) {
  if (cache.has(assetPath)) return cache.get(assetPath);
  const file = rootDir ? path.join(rootDir, assetPath.replace(/^\//, "")) : null;
  // A missing file is a build error waiting to happen, but not one worth
  // stopping a build over: the asset still loads, just without the cache key.
  const stamp = file && existsSync(file)
    ? createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8)
    : "0";
  const result = `${assetPath}?v=${stamp}`;
  cache.set(assetPath, result);
  return result;
}
