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
  ...publicDirectories.map((directory) =>
    cp(path.join(rootDir, directory), path.join(outputDir, directory), {
      recursive: true,
    })
  ),
]);

console.log(`Built ${path.relative(rootDir, outputDir)} from explicit public assets.`);
