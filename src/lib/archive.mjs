/*
# Project:     lovemallacoota.au
# File Name:   archive.mjs
# Description: The Mouth catalogue, read at build time. The 37 issues and their
#              contents are the largest body of unique local text on the site,
#              so they are rendered into the HTML rather than fetched by the
#              browser. The page script only filters what is already there.
*/

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = [
  process.cwd(),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
].find((candidate) => existsSync(path.join(candidate, "data", "archive-index.json")));

export function loadArchive() {
  if (!rootDir) return { issues: [] };
  return JSON.parse(
    readFileSync(path.join(rootDir, "data", "archive-index.json"), "utf8")
  );
}

export function archiveIssues(archive = loadArchive()) {
  return [...(archive.issues || [])].sort(
    (a, b) => b.publicationDate.localeCompare(a.publicationDate)
  );
}

export function archiveYears(issues) {
  const counts = new Map();
  for (const issue of issues) {
    const year = String(issue.publicationDate || "").slice(0, 4);
    if (year) counts.set(year, (counts.get(year) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, count]) => ({ year, count }));
}

/** Everything the search box looks through, rendered into the card. */
export function issueSearchText(issue) {
  return [
    issue.publication,
    issue.issueNumber,
    issue.displayDate,
    issue.publicationDate,
    issue.editor,
    issue.description,
    issue.provenance,
    issue.cover?.caption,
    issue.cover?.credit,
    ...(issue.topics || []),
    ...(issue.keywords || []),
    ...(issue.contents || []).map((entry) => `${entry.page} ${entry.title}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * The catalogue as structured data. Each issue is a PublicationIssue; none
 * carries a URL, because no PDF is published until its rights are recorded.
 */
export function archiveSchema(issues, archive) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: archive.title || "The Mallacoota Mouth archive",
    url: "https://lovemallacoota.au/archive.html",
    description: archive.holdingsNote || undefined,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: issues.length,
      itemListElement: issues.map((issue, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "PublicationIssue",
          issueNumber: issue.issueNumber,
          datePublished: issue.publicationDate,
          name: `${issue.publication} — issue ${issue.issueNumber}`,
          description: issue.description || undefined,
          editor: issue.editor ? { "@type": "Person", name: issue.editor } : undefined,
          isPartOf: {
            "@type": "Periodical",
            name: issue.publication,
            publisher: archive.publisher || undefined,
          },
        },
      })),
    },
  };
}
