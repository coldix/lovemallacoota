import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "dist");
const manifestPath = path.join(rootDir, "data", "site-version.json");
const readmePath = path.join(rootDir, "README.md");
const builtManifestPath = path.join(outputDir, "data", "site-version.json");
const timeZone = "Australia/Melbourne";
const args = new Set(process.argv.slice(2));

function melbourneParts(date) {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });

  return Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
}

function timestampFromParts(parts) {
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName} (Melbourne)`;
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return null;
  }
}

function nextVersion(currentVersion) {
  const setArg = [...args].find((arg) => arg.startsWith("--set="));
  if (setArg) {
    const version = setArg.slice("--set=".length);
    if (!/^v\d+\.\d{2}$/.test(version)) {
      throw new Error("Use --set=v0.01 style version numbers.");
    }
    return version;
  }

  const match = /^v(\d+)\.(\d{2})$/.exec(currentVersion || "");
  if (args.has("--major")) {
    const major = match ? Number(match[1]) + 1 : 1;
    return `v${major}.00`;
  }

  if (!match) return "v0.01";

  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (minor >= 99) {
    return `v${major + 1}.00`;
  }

  return `v${major}.${String(minor + 1).padStart(2, "0")}`;
}

async function collectDirectoryFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(outputDir, absolutePath).replaceAll(path.sep, "/");

    if (entry.isDirectory()) {
      files.push(...(await collectDirectoryFiles(absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

async function fileRecord(relativePath) {
  const absolutePath = path.join(outputDir, relativePath);
  const buffer = await readFile(absolutePath);
  const fileStat = await stat(absolutePath);

  return {
    path: relativePath,
    bytes: fileStat.size,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

/*
 * The README's own version line and badge, kept true by the same run that
 * raises the version. Written by hand they drifted six releases behind, which
 * is worse than absent: a reader trusts a number that is there.
 *
 * The date is read back out of the manifest rather than taken from the clock,
 * so the --stamp and --files phases of one build cannot disagree.
 */
const READABLE_DATE = new Intl.DateTimeFormat("en-AU", {
  timeZone,
  day: "numeric",
  month: "long",
  year: "numeric",
});

function readableDate(generatedAtValue) {
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})/.exec(generatedAtValue || "");
  if (!isoDay) return null;
  // Midday, so no timezone shift can move it to the day before.
  const parsed = new Date(`${isoDay[1]}-${isoDay[2]}-${isoDay[3]}T12:00:00+10:00`);
  return Number.isNaN(parsed.valueOf()) ? null : READABLE_DATE.format(parsed);
}

async function stampReadme(versionValue, generatedAtValue) {
  let readme;
  try {
    readme = await readFile(readmePath, "utf8");
  } catch {
    return;
  }

  const when = readableDate(generatedAtValue);
  const line = when ? `**${versionValue}** - built ${when}.` : `**${versionValue}**`;
  const block = `<!-- version -->\n${line}\n<!-- /version -->`;
  const markers = /<!-- version -->[\s\S]*?<!-- \/version -->/;

  if (!markers.test(readme)) {
    console.warn("README.md has no <!-- version --> block; leaving it alone.");
    return;
  }

  const updated = readme
    .replace(markers, block)
    .replace(/badge\/version-v[\d.]+-/, `badge/version-${versionValue}-`);

  if (updated !== readme) {
    await writeFile(readmePath, updated);
    console.log(`Stamped README.md with ${versionValue}`);
  }
}

/*
 * Two phases, because the pages carry the version number in their own footer.
 *
 *   --stamp   raise the version and the date, before the build
 *   --files   hash what the build produced, keeping that version and date
 *
 * Run as one step the build would render the previous version into every
 * page, and only the footer's fetch of this file would say otherwise: the
 * HTML said v1.26 while the manifest said v1.27. With no flag it still does
 * both, for anyone calling it by hand.
 */
const stampOnly = args.has("--stamp");
const filesOnly = args.has("--files");

const existing = await readManifest();
const version = filesOnly
  ? existing?.version || nextVersion(null)
  : nextVersion(existing?.version || null);
const generatedAt = filesOnly
  ? existing?.generatedAt || timestampFromParts(melbourneParts(new Date()))
  : timestampFromParts(melbourneParts(new Date()));

// Stamping happens before there is a build to hash, so the previous file list
// is carried over rather than emptied.
let records = existing?.files || [];
if (!stampOnly) {
  const files = (await collectDirectoryFiles(outputDir))
    .filter((file) => file !== "data/site-version.json")
    .sort();
  records = await Promise.all(files.map(fileRecord));
}

const manifest = {
  project: "lovemallacoota.au",
  version,
  generatedAt,
  timezone: timeZone,
  generator: "tools/update-version.mjs",
  files: records,
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
if (!stampOnly) await writeFile(builtManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${path.relative(rootDir, manifestPath)} version ${manifest.version}`);
await stampReadme(manifest.version, manifest.generatedAt);
