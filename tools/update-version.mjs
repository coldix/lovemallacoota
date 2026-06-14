import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(rootDir, "data", "site-version.json");
const timeZone = "Australia/Melbourne";
const args = new Set(process.argv.slice(2));

const ignoredDirs = new Set([".git", "node_modules"]);
const ignoredFiles = new Set([".DS_Store", "Thumbs.db", "data/site-version.json"]);

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

async function readCurrentVersion() {
  try {
    const current = JSON.parse(await readFile(manifestPath, "utf8"));
    return typeof current.version === "string" ? current.version : null;
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
    throw new Error("Current version is at .99. Use --major for the next major release.");
  }

  return `v${major}.${String(minor + 1).padStart(2, "0")}`;
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath).replaceAll(path.sep, "/");

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...(await collectFiles(absolutePath)));
      }
      continue;
    }

    if (entry.isFile() && !ignoredFiles.has(relativePath) && !ignoredFiles.has(entry.name)) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

async function fileRecord(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const buffer = await readFile(absolutePath);
  const fileStat = await stat(absolutePath);

  return {
    path: relativePath,
    bytes: fileStat.size,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

async function updateRuntimeFallback(version, generatedAt) {
  const runtimePath = path.join(rootDir, "assets", "js", "script.js");
  const current = await readFile(runtimePath, "utf8");
  const next = current
    .replace(/const FILE_VERSION = ".*?";/, `const FILE_VERSION = "${version}";`)
    .replace(/const FILE_DATE = ".*?";/, `const FILE_DATE = "${generatedAt}";`);

  if (next !== current) {
    await writeFile(runtimePath, next);
  }
}

const now = new Date();
const parts = melbourneParts(now);
const version = nextVersion(await readCurrentVersion());
const generatedAt = timestampFromParts(parts);

await updateRuntimeFallback(version, generatedAt);

const files = await collectFiles(rootDir);
const records = await Promise.all(files.map(fileRecord));

const manifest = {
  project: "lovemallacoota.com.au",
  version,
  generatedAt,
  timezone: timeZone,
  generator: "tools/update-version.mjs",
  files: records,
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${path.relative(rootDir, manifestPath)} version ${manifest.version}`);
