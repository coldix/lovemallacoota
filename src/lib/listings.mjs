/*
# Project:     lovemallacoota.au
# File Name:   listings.mjs
# Description: Build-time directory data. Astro reads the listing JSON here and
#              renders both the cards and the LocalBusiness JSON-LD into the
#              static HTML, so crawlers that do not run JavaScript still see
#              every business. The browser script only filters what is already
#              in the page.
*/

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Astro bundles this module into dist/.prerender before running it, so a path
// relative to import.meta.url no longer points at the repository. Find the root
// by looking for the data directory, from the working directory first.
const rootDir = [
  process.cwd(),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
].find((candidate) => existsSync(path.join(candidate, "data", "listings_food.json")));

if (!rootDir) {
  throw new Error("Cannot locate the data directory — run builds and tests from the project root");
}

export const SITE_ORIGIN = "https://lovemallacoota.au";

/** Category tags that describe the page itself, not the business. */
const GENERIC_TAG = /^(food & drink|accommodation|activities|tours & activities|other)$/i;

function readListingFile(file) {
  const parsed = JSON.parse(readFileSync(path.join(rootDir, "data", file), "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`data/${file} must be an array of listings`);
  }
  return parsed;
}

export function loadListings(files) {
  return files
    .flatMap(readListingFile)
    .filter(Boolean)
    .sort((a, b) => (a.business_name || "").localeCompare(b.business_name || ""));
}

export function getPrimaryLink(business) {
  if (Array.isArray(business.links) && business.links.length) {
    const site =
      business.links.find((link) => (link.text || "").toLowerCase() === "website") ||
      business.links[0];
    return site?.url;
  }
  if (Array.isArray(business.social_links) && business.social_links.length) {
    return business.social_links[0].url;
  }
  return null;
}

export function getPrimaryLinkLabel(business) {
  const primary = getPrimaryLink(business);
  if (!primary) return null;
  return (
    (Array.isArray(business.links) && business.links.find((l) => l.url === primary)?.text) ||
    "Website"
  );
}

export function formatAddress(address) {
  if (!address) return "";
  return [address.street, address.locality].filter(Boolean).join(", ");
}

export function displayTags(business) {
  return (business.category_tags || []).filter((tag) => !GENERIC_TAG.test(tag));
}

/** Tag buttons for the filter row, most used first, capped at twelve. */
export function tagFilters(businesses) {
  const counts = new Map();
  for (const business of businesses) {
    for (const tag of displayTags(business)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([tag]) => tag);
}

/** Search haystack, rendered into the card so the browser never refetches data. */
export function searchText(business) {
  return [
    business.business_name,
    business.description_short,
    business.description_long,
    ...(business.category_tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function mapLinks(business) {
  const links = [];
  if (business.geo?.latitude && business.geo?.longitude) {
    const { latitude, longitude } = business.geo;
    links.push({
      url: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      text: "Map",
    });
    links.push({
      url: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      text: "Directions",
    });
  } else if (business.address) {
    const query = encodeURIComponent(
      [
        business.address.street,
        business.address.locality,
        business.address.state,
        business.address.postcode,
      ]
        .filter(Boolean)
        .join(", ")
    );
    links.push({ url: `https://www.google.com/maps/search/?api=1&query=${query}`, text: "Map" });
  }
  return links;
}

export function telHref(phone) {
  return `tel:${String(phone).replace(/\s+/g, "")}`;
}

/**
 * Hero image for a listing, but only when the file is actually in the
 * repository. Referencing an image that is not deployed puts a 404 into the
 * structured data, which is worse than having no image at all.
 */
export function heroImage(business) {
  const images = business.images || [];
  const hero = images.find((image) => image.is_hero) || images[0];
  if (!hero?.url) return null;
  const relative = hero.url.replace(/^\//, "");
  if (!existsSync(path.join(rootDir, relative))) return null;
  return hero;
}

/** Every image path referenced by the data, whether or not the file exists. */
export function referencedImages(files) {
  return files.flatMap(readListingFile).flatMap((business) =>
    (business.images || [])
      .map((image) => image.url)
      .filter(Boolean)
      .map((url) => ({ business: business.business_name, url }))
  );
}

export const ALL_LISTING_FILES = [
  "listings_food.json",
  "listings_accom.json",
  "listings_do.json",
];

function pruneUndefined(object) {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined || object[key] === null) delete object[key];
  }
  return object;
}

export function businessSchema(business) {
  const hero = heroImage(business);
  return pruneUndefined({
    "@type": business.schema_type || "LocalBusiness",
    name: business.business_name,
    description: business.description_long || business.description_short,
    image: hero ? `${SITE_ORIGIN}${hero.url}` : undefined,
    url: getPrimaryLink(business) || undefined,
    telephone: business.phone ? String(business.phone).replace(/\s+/g, "") : undefined,
    email: business.email || undefined,
    address: business.address
      ? {
          "@type": "PostalAddress",
          streetAddress: business.address.street,
          addressLocality: business.address.locality,
          addressRegion: business.address.state,
          postalCode: business.address.postcode,
          addressCountry: "AU",
        }
      : undefined,
    geo: business.geo
      ? {
          "@type": "GeoCoordinates",
          latitude: business.geo.latitude,
          longitude: business.geo.longitude,
        }
      : undefined,
    openingHoursSpecification:
      business.opening_hours_specification ||
      (business.opening_hours?.length ? business.opening_hours : undefined),
  });
}

export function collectionSchema(businesses, pageTitle, pagePath) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageTitle,
    url: `${SITE_ORIGIN}${pagePath}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: businesses.map((business, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: businessSchema(business),
      })),
    },
  };
}

/**
 * How this listing's contact details were checked. A listing with no
 * verification block is "Not yet verified" — never verified by default, and a
 * date is only ever written by an actual verification. See
 * docs/DIRECTORY-SUBMISSIONS.md.
 */
export function verificationState(business) {
  const verification = business.verification || {};
  const email = verification.email || {};
  const mobile = verification.mobile || {};
  return {
    emailVerifiedAt: email.verifiedAt || null,
    mobileSupplied: Boolean(mobile.value),
    // No SMS provider exists yet, so a mobile is supplied, never verified.
    mobileVerified: false,
    lastReviewedAt: verification.lastReviewedAt || null,
  };
}

const AU_DATE = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Australia/Melbourne",
});

export function formatVerificationDate(isoDate) {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00+10:00`);
  return Number.isNaN(parsed.valueOf()) ? null : AU_DATE.format(parsed);
}

/** The line shown on the card. Says what is true, including when nothing is. */
export function verificationLine(business) {
  const state = verificationState(business);
  const when = formatVerificationDate(state.emailVerifiedAt);
  if (when) return { verified: true, text: `Email verified ${when}` };
  return { verified: false, text: "Not yet verified" };
}

/**
 * The listing's photo, if the file is actually in the build. One per listing,
 * 1280px on the longest side, WebP.
 */
export function listingPhoto(business) {
  const hero = heroImage(business);
  if (!hero) return null;
  return { url: hero.url, alt: hero.alt_text || business.business_name || "" };
}
