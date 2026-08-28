import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { publicDirectories, publicFiles } from "./public-files.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "dist");

await mkdir(outputDir, { recursive: true });

await Promise.all([
  ...publicFiles.map((file) =>
    cp(path.join(rootDir, file), path.join(outputDir, file))
  ),
  // A directory that holds only per-week files is empty until the first one
  // arrives, and git does not track empty directories. Its absence is normal.
  ...publicDirectories.map(async (directory) => {
    const from = path.join(rootDir, directory);
    if (!existsSync(from)) {
      console.log(`Skipping ${directory} — nothing in it yet.`);
      return;
    }
    await cp(from, path.join(outputDir, directory), { recursive: true });
  }),
]);

console.log(`Built ${path.relative(rootDir, outputDir)} from explicit public assets.`);
