/*
# Project:     lovemallacoota.au
# File Name:   sitemap.xml.js
# Description: The sitemap, generated from what the build actually produces.
#              The hand-maintained file it replaces had lastmod dates six weeks
#              older than the pages, and listed none of the weekly editions.
*/

import { loadEditions } from "../lib/editions.mjs";
import { loadArchive } from "../lib/archive.mjs";
import { listingPagePath, loadDirectory } from "../lib/directory.mjs";

const ORIGIN = "https://lovemallacoota.au";

export function sitemapEntries(today) {
  const editions = loadEditions();
  const archive = loadArchive();

  // Priorities follow the navigation: what is happening now, then the
  // directory, then the pages that support them. Pages carrying noindex are
  // absent by design — a sitemap that lists them contradicts the page.
  const entries = [
    { path: "/", changefreq: "weekly", priority: "1.0", lastmod: today },
    { path: "/edition.html", changefreq: "daily", priority: "1.0", lastmod: today },
    { path: "/calendar.html", changefreq: "weekly", priority: "0.9" },
    { path: "/directory.html", changefreq: "weekly", priority: "0.9" },
    { path: "/food.html", changefreq: "weekly", priority: "0.9" },
    { path: "/accom.html", changefreq: "weekly", priority: "0.9" },
    { path: "/activity.html", changefreq: "weekly", priority: "0.9" },
    { path: "/community.html", changefreq: "weekly", priority: "0.8" },
    { path: "/services.html", changefreq: "weekly", priority: "0.8" },
    { path: "/archive.html", changefreq: "weekly", priority: "0.8", lastmod: archive.updatedAt },
    { path: "/emergency.html", changefreq: "monthly", priority: "0.7" },
    { path: "/add-listing.html", changefreq: "yearly", priority: "0.6" },
    { path: "/directory-changes.html", changefreq: "weekly", priority: "0.5" },
    { path: "/claim.html", changefreq: "yearly", priority: "0.5" },
    { path: "/submit-event.html", changefreq: "yearly", priority: "0.5" },
    { path: "/contact.html", changefreq: "yearly", priority: "0.5" },
    { path: "/editorial-policy.html", changefreq: "yearly", priority: "0.4" },
    { path: "/corrections.html", changefreq: "yearly", priority: "0.4" },
    { path: "/accessibility.html", changefreq: "yearly", priority: "0.4" },
    { path: "/privacy.html", changefreq: "yearly", priority: "0.4" },
    { path: "/terms.html", changefreq: "yearly", priority: "0.4" },
  ];

  for (const entity of loadDirectory()) {
    entries.push({
      path: listingPagePath(entity),
      changefreq: "monthly",
      priority: entity.official ? "0.8" : "0.6",
    });
  }

  // Every week keeps a permanent page, and a frozen one never changes again.
  for (const edition of editions) {
    entries.push({
      path: `/edition/${edition.week}.html`,
      changefreq: edition.status === "open" ? "daily" : "yearly",
      priority: edition.status === "open" ? "0.8" : "0.6",
      lastmod: edition.frozenAt ? edition.frozenAt.slice(0, 10) : edition.weekStart,
    });
  }

  return entries;
}

export function renderSitemap(entries) {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : "";
      return `  <url>\n    <loc>${ORIGIN}${entry.path}</loc>${lastmod}\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function GET() {
  const today = new Date().toISOString().slice(0, 10);
  return new Response(renderSitemap(sitemapEntries(today)), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
