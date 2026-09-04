/*
# Project:     lovemallacoota.au
# File Name:   directory-model.mjs
# Description: Unified directory entities. Pure functions — no filesystem — so
#              the Astro build and the Worker can share the same rules.
*/

export const SITE_ORIGIN = "https://lovemallacoota.au";

export const SECTIONS = {
  "eat-drink": {
    id: "eat-drink",
    label: "Eat & Drink",
    href: "/food.html",
    emoji: "🦪",
    blurb: "Cafes, pubs, takeaway, seafood and groceries.",
    active: "food",
  },
  stay: {
    id: "stay",
    label: "Stay",
    href: "/accom.html",
    emoji: "🛏️",
    blurb: "Lodges, motels, holiday houses and caravan parks.",
    active: "accom",
  },
  "do-see": {
    id: "do-see",
    label: "Do & See",
    href: "/activity.html",
    emoji: "🛶",
    blurb: "Boat hire, walks, beaches, tours and attractions.",
    active: "activity",
  },
  community: {
    id: "community",
    label: "Community",
    href: "/community.html",
    emoji: "🤝",
    blurb: "Clubs, sport, arts, churches, media and volunteer groups.",
    active: "community",
  },
  services: {
    id: "services",
    label: "Services",
    href: "/services.html",
    emoji: "🛠️",
    blurb: "Trades, health, shops, government and public services.",
    active: "services",
  },
};

export const WHATS_ON = {
  id: "whats-on",
  label: "What's On",
  href: "/calendar.html",
  emoji: "📅",
  blurb: "Events, the community calendar and this week's edition.",
  active: "calendar",
};

/** Shops that used to sit under Do & See. They belong in Services. */
export const SHOP_SLUGS = new Set([
  "mallacoota-surf-shack",
  "mapa-pearls",
  "sues-bribes",
  "wilderness-coast-candles",
]);

/**
 * Public entity types. Government and emergency listings are official and
 * cannot be claimed through the public form.
 */
export const ENTITY_TYPES = {
  business: { label: "Business", schema: "LocalBusiness", official: false, sectionHint: "eat-drink" },
  trade: { label: "Trade or professional service", schema: "HomeAndConstructionBusiness", official: false, sectionHint: "services" },
  professional: { label: "Professional service", schema: "ProfessionalService", official: false, sectionHint: "services" },
  "community-organisation": { label: "Community group", schema: "NGO", official: false, sectionHint: "community" },
  "sporting-club": { label: "Sporting organisation", schema: "SportsOrganization", official: false, sectionHint: "community" },
  "social-group": { label: "Social group", schema: "Organization", official: false, sectionHint: "community" },
  arts: { label: "Arts or cultural organisation", schema: "Organization", official: false, sectionHint: "community" },
  government: { label: "Government or public service", schema: "GovernmentOrganization", official: true, sectionHint: "services" },
  school: { label: "School or education", schema: "EducationalOrganization", official: true, sectionHint: "services" },
  church: { label: "Church or faith group", schema: "Church", official: false, sectionHint: "community" },
  emergency: { label: "Emergency service", schema: "EmergencyService", official: true, sectionHint: "services" },
  media: { label: "Media, radio or publication", schema: "RadioStation", official: false, sectionHint: "community" },
  "community-facility": { label: "Community facility", schema: "CivicStructure", official: false, sectionHint: "community" },
  "facebook-group": { label: "Community Facebook group", schema: "Organization", official: false, sectionHint: "community" },
  other: { label: "Other", schema: "Organization", official: false, sectionHint: "community" },
};

export const FORM_ENTITY_TYPES = [
  "business",
  "trade",
  "professional",
  "community-organisation",
  "sporting-club",
  "social-group",
  "arts",
  "government",
  "school",
  "church",
  "media",
  "community-facility",
  "other",
];

const SECTION_FROM_IA = {
  Community: "community",
  Services: "services",
};

/**
 * The filters offered inside a section, and the whole of the tag vocabulary.
 *
 * The old tags were three things at once: the Consumer Affairs headings a
 * listing arrived with, accommodation subtypes, and one-off menu words -
 * Chinese, Kayak, Brunch, Radio - that named a single listing each. A filter
 * that matches one listing is not a filter, it is a caption, so those moved to
 * the listing's `kind` (see listingKind) where they read as a description
 * rather than pretending to be a way through the directory.
 *
 * One or two per listing. The section is the tree; this is the only level
 * below it.
 */
export const SECTION_FILTERS = {
  "eat-drink": ["Cafe & coffee", "Pub & restaurant", "Takeaway", "Groceries"],
  stay: ["Camping & caravan", "Motel & units", "Holiday house"],
  "do-see": ["Boating & fishing", "Walks & beaches", "Arts & culture", "Attractions"],
  community: ["Sport", "Clubs & groups", "Arts & culture", "Church & volunteer", "Facebook & media"],
  services: ["Shops", "Health", "Trades", "Government"],
};

/** Every filter name, for validation and for the broad-tag test below. */
export const ALL_FILTERS = new Set(Object.values(SECTION_FILTERS).flat());

/**
 * Where an association's Consumer Affairs heading lands when no enrichment
 * record has chosen a filter for it by hand. A fallback, not the main path:
 * every published association is tagged explicitly in the enrichment file.
 */
const FILTER_FROM_IA = {
  "Clubs & Groups": "Clubs & groups",
  "Sport & Recreation": "Sport",
  "Arts & Social": "Arts & culture",
  "Churches & Community Organisations": "Church & volunteer",
  "Local Media & Facebook Groups": "Facebook & media",
  "Trades & Home Services": "Trades",
  "Health & Aged Care": "Health",
  "Shops & Local Businesses": "Shops",
  "Government & Public Services": "Government",
};

const TYPE_FROM_CATEGORY = {
  "Clubs & Groups": "community-organisation",
  "Sport & Recreation": "sporting-club",
  "Arts & Social": "arts",
  "Churches & Community Organisations": "community-organisation",
  "Local Media & Facebook Groups": "media",
  "Trades & Home Services": "trade",
  "Health & Aged Care": "community-organisation",
  "Shops & Local Businesses": "business",
  "Government & Public Services": "government",
};

const GENERIC_TAG = /^(food & drink|accommodation|activities|tours & activities|other|community|services)$/i;

const SMALL_WORDS = new Set(["of", "and", "the", "in", "for", "a", "an", "&"]);

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function displayAssociationName(legalName) {
  const stripped = String(legalName || "")
    .replace(/\s+INCORPORATED$/i, "")
    .replace(/\s+INC\.?$/i, "")
    .trim();
  return stripped
    .split(/(\s+|[&()/])/g)
    .map((token, index, parts) => {
      if (!token || /^(\s+|[&()/])$/.test(token)) return token;
      const lower = token.toLowerCase();
      if (lower === "u3a") return "U3A";
      if (lower === "inc") return "Inc";
      const isFirstWord = !parts.slice(0, index).some((part) => /[a-z0-9]/i.test(part));
      if (!isFirstWord && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

export function formatAddress(address) {
  if (!address) return "";
  return [address.street, address.locality].filter(Boolean).join(", ");
}

export function displayTags(entity) {
  return (entity.categories || entity.category_tags || []).filter((tag) => !GENERIC_TAG.test(tag));
}

export function tagFilters(entities, cap = 12) {
  const counts = new Map();
  for (const entity of entities) {
    for (const tag of displayTags(entity)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cap)
    .map(([tag]) => tag);
}

export function searchText(entity) {
  return [
    entity.name,
    entity.business_name,
    entity.legalName,
    entity.commonName,
    entity.description,
    entity.descriptionShort,
    entity.description_short,
    entity.description_long,
    entity.meetingTimes,
    entity.serviceArea,
    entity.registration?.number,
    entity.entityType,
    ...(entity.categories || entity.category_tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getPrimaryLink(entity) {
  if (entity.website) return entity.website;
  if (Array.isArray(entity.links) && entity.links.length) {
    const site =
      entity.links.find((link) => /website/i.test(link.text || "")) || entity.links[0];
    return site?.url;
  }
  if (Array.isArray(entity.social) && entity.social.length) return entity.social[0].url;
  if (Array.isArray(entity.social_links) && entity.social_links.length) {
    return entity.social_links[0].url;
  }
  return null;
}

export function getPrimaryLinkLabel(entity) {
  const primary = getPrimaryLink(entity);
  if (!primary) return null;
  const fromLinks = (entity.links || []).find((link) => link.url === primary);
  if (fromLinks?.text) return fromLinks.text;
  if (entity.website && primary === entity.website) return "Website";
  return "Website";
}

export function mapLinks(entity) {
  const links = [];
  if (entity.geo?.latitude && entity.geo?.longitude) {
    const { latitude, longitude } = entity.geo;
    links.push({
      url: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      text: "Map",
    });
    links.push({
      url: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      text: "Directions",
    });
  } else if (entity.address && (entity.address.street || entity.address.locality)) {
    const query = encodeURIComponent(
      [entity.address.street, entity.address.locality, entity.address.state, entity.address.postcode]
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

export function isOfficialEntity(entity) {
  if (entity.official === true) return true;
  const type = ENTITY_TYPES[entity.entityType];
  return Boolean(type?.official);
}

export function canClaim(entity) {
  if (entity.claimable === false) return false;
  if (isOfficialEntity(entity)) return false;
  if (entity.entityType === "facebook-group") return false;
  if (entity.status && entity.status !== "published") return false;
  // Already claimed. Somebody proved control of the published address and holds
  // a link to edit it; offering "Claim this listing" to the next visitor invites
  // a request that will be refused, and reads to the owner as though claiming
  // had not worked.
  if (entity.verification?.email?.verifiedAt) return false;
  return true;
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

export function verificationState(entity) {
  const verification = entity.verification || {};
  const email = verification.email || {};
  const mobile = verification.mobile || {};
  return {
    emailVerifiedAt: email.verifiedAt || null,
    mobileSupplied: Boolean(mobile.value),
    mobileVerified: false,
    lastReviewedAt: verification.lastReviewedAt || null,
    sourceKind: entity.source?.kind || null,
  };
}

/**
 * The line shown on the card. Says what is true, including when nothing is.
 * A date is only ever a date that actually happened.
 */
export function verificationLine(entity) {
  const state = verificationState(entity);
  const emailWhen = formatVerificationDate(state.emailVerifiedAt);
  if (emailWhen) return { verified: true, kind: "email", text: `Email verified ${emailWhen}` };

  const reviewed = formatVerificationDate(state.lastReviewedAt);
  if (isOfficialEntity(entity) && reviewed) {
    return { verified: true, kind: "official", text: `Official source, checked ${reviewed}` };
  }
  if (state.sourceKind === "official-register") {
    return {
      verified: false,
      kind: "register",
      text: "Listed from the Consumer Affairs Victoria register. Contact details not yet confirmed.",
    };
  }
  if (reviewed) return { verified: false, kind: "reviewed", text: `Last checked ${reviewed}` };
  return { verified: false, kind: "none", text: "Not yet verified" };
}

export function isStale(entity, todayIso, months = 18) {
  const reviewed = entity.verification?.lastReviewedAt || entity.verification?.email?.verifiedAt;
  if (!reviewed) return false;
  const reviewedDate = new Date(`${reviewed}T00:00:00+10:00`);
  const today = new Date(`${todayIso}T00:00:00+10:00`);
  const limit = new Date(today);
  limit.setMonth(limit.getMonth() - months);
  return reviewedDate < limit;
}

function pruneUndefined(object) {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined || object[key] === null) delete object[key];
  }
  return object;
}

export function schemaTypeFor(entity) {
  if (entity.schema_type) return entity.schema_type;
  return ENTITY_TYPES[entity.entityType]?.schema || "Organization";
}

export function entitySchema(entity, photoUrl) {
  const type = schemaTypeFor(entity);
  return pruneUndefined({
    "@type": type,
    name: entity.name,
    legalName: entity.legalName || undefined,
    alternateName: entity.commonName || undefined,
    description: entity.description || entity.description_long || entity.description_short,
    image: photoUrl || undefined,
    url: getPrimaryLink(entity) || undefined,
    telephone: entity.phone ? String(entity.phone).replace(/\s+/g, "") : undefined,
    email: entity.email || undefined,
    address: entity.address
      ? {
          "@type": "PostalAddress",
          streetAddress: entity.address.street || undefined,
          addressLocality: entity.address.locality || undefined,
          addressRegion: entity.address.state || undefined,
          postalCode: entity.address.postcode || undefined,
          addressCountry: "AU",
        }
      : undefined,
    geo:
      entity.geo?.latitude && entity.geo?.longitude
        ? {
            "@type": "GeoCoordinates",
            latitude: entity.geo.latitude,
            longitude: entity.geo.longitude,
          }
        : undefined,
    // The listing data holds bare {dayOfWeek, opens, closes} objects. Schema.org
    // needs each one typed, and without the @type Google discards the hours
    // rather than reading them.
    openingHoursSpecification: typeOpeningHours(
      entity.openingHoursSpecification ||
        entity.opening_hours_specification ||
        (entity.openingHours?.length ? entity.openingHours : undefined) ||
        (entity.opening_hours?.length ? entity.opening_hours : undefined)
    ),
    sameAs: [
      ...(entity.social || entity.social_links || []).map((link) => link.url).filter(Boolean),
      entity.source?.url,
    ].filter(Boolean),
  });
}

/** Each period as a typed OpeningHoursSpecification, whatever shape it arrived in. */
function typeOpeningHours(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return undefined;
  return periods.map((period) => ({ "@type": "OpeningHoursSpecification", ...period }));
}

export function collectionSchema(entities, pageTitle, pagePath, photoFor) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageTitle,
    url: `${SITE_ORIGIN}${pagePath}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: entities.map((entity, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_ORIGIN}/listing/${entity.slug}.html`,
        item: entitySchema(entity, photoFor ? photoFor(entity) : undefined),
      })),
    },
  };
}

export function looksLikeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Strip tags so a submitted description cannot carry markup. */
export function plainText(value, max = 2000) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function entityTypeFromRaw(raw, fallback) {
  if (raw.entityType && ENTITY_TYPES[raw.entityType]) return raw.entityType;
  if (raw.schema_type === "Museum") return "community-facility";
  if (SHOP_SLUGS.has(raw.slug)) return "business";
  return fallback || "business";
}

function sectionFromRaw(raw, fallback) {
  if (raw.section && SECTIONS[raw.section]) return raw.section;
  if (SHOP_SLUGS.has(raw.slug)) return "services";
  const primary = raw.category_primary || "";
  if (/shopping/i.test(primary)) return "services";
  return fallback;
}

export function normalizeListing(raw, defaults = {}) {
  if (!raw) return null;
  const name = raw.name || raw.business_name;
  if (!name) return null;
  const slug = raw.slug || slugify(name);
  const entityType = entityTypeFromRaw(raw, defaults.entityType);
  const section = sectionFromRaw(raw, defaults.section);
  const categories = raw.categories || displayTags(raw);
  const official = raw.official === true || ENTITY_TYPES[entityType]?.official === true;
  return {
    id: raw.id || slug,
    slug,
    name,
    business_name: name,
    legalName: raw.legalName || null,
    commonName: raw.commonName || null,
    entityType,
    section,
    categories: categories.length ? categories : raw.category_tags || [],
    category_tags: raw.category_tags || categories,
    // What this listing is, in the words a person would use. The filters above
    // are shelves; this is the thing on the shelf, and it is what the page
    // title and the meta description say.
    kind: raw.kind || null,
    description: raw.description || raw.description_long || raw.description_short || "",
    descriptionShort: raw.descriptionShort || raw.description_short || "",
    description_short: raw.description_short || raw.descriptionShort || "",
    description_long: raw.description_long || raw.description || "",
    address: raw.address || null,
    locationKind: raw.locationKind || (raw.address?.street ? "physical" : "none"),
    geo: raw.geo || null,
    serviceArea: raw.serviceArea || null,
    // Whether the business is trading. Deliberately not called status: the
    // model already uses that for publication state, and a second meaning on
    // the same key silently overwrote this one.
    trading: raw.trading || null,
    phone: raw.phone || null,
    email: raw.email || null,
    website: raw.website || getPrimaryLink(raw),
    links: raw.links || [],
    social: raw.social || raw.social_links || [],
    social_links: raw.social_links || raw.social || [],
    openingHours: raw.openingHours || raw.opening_hours || [],
    opening_hours: raw.opening_hours || raw.openingHours || [],
    meetingTimes: raw.meetingTimes || null,
    accessibility: raw.accessibility || null,
    images: raw.images || [],
    // A priced menu, for the places whose whole offer is the menu. Grouped
    // rather than flat, because a board reads in courses and a single list of
    // fourteen priced lines does not. Carries the date it was copied: a price
    // is a fact about a day, and one shown without one is a promise.
    menu: raw.menu || null,
    notes_seasonal: raw.notes_seasonal || null,
    status: raw.status || "published",
    claimable: raw.claimable === undefined ? !official && entityType !== "facebook-group" : raw.claimable,
    official,
    registration: raw.registration || null,
    related: raw.related || [],
    source: raw.source || defaults.source || { kind: "existing-listing" },
    verification: raw.verification || {},
    schema_type: raw.schema_type || ENTITY_TYPES[entityType]?.schema,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

export function associationToEntity(assoc, enrichment = {}) {
  const legalName = assoc.name;
  const name = enrichment.name || enrichment.commonName || displayAssociationName(legalName);
  const iaSection = assoc.ia?.[0];
  const iaCategory = assoc.ia?.[1];
  const section = enrichment.section || SECTION_FROM_IA[iaSection] || "community";
  const entityType = enrichment.entityType || TYPE_FROM_CATEGORY[iaCategory] || "community-organisation";
  const slug = enrichment.slug || slugify(enrichment.commonName || name);
  const seedNote =
    enrichment.description ||
    `${name} is a registered incorporated association in Victoria. Contact details have not yet been confirmed from another public source. If this is your organisation, claim the listing to add them.`;

  return normalizeListing(
    {
      id: `ia-${assoc.number}`,
      slug,
      name,
      legalName,
      commonName: enrichment.commonName || null,
      entityType,
      section,
      categories:
        enrichment.categories || [FILTER_FROM_IA[iaCategory] || "Clubs & groups"],
      kind: enrichment.kind || null,
      description: seedNote,
      descriptionShort:
        enrichment.descriptionShort ||
        "Registered Victorian incorporated association. Contact details not yet confirmed.",
      address: enrichment.address || null,
      geo: enrichment.geo || null,
      phone: enrichment.phone || null,
      email: enrichment.email || null,
      website: enrichment.website || null,
      links: [
        ...(enrichment.links || []),
        assoc.details_url
          ? { url: assoc.details_url, text: "Consumer Affairs Victoria register" }
          : null,
      ].filter(Boolean),
      social: enrichment.social || [],
      openingHours: enrichment.openingHours || [],
      meetingTimes: enrichment.meetingTimes || null,
      accessibility: enrichment.accessibility || null,
      images: enrichment.images || [],
      status: "published",
      claimable: enrichment.claimable !== false,
      official: false,
      related: enrichment.related || [],
      registration: {
        authority: "Consumer Affairs Victoria",
        number: assoc.number,
        status: assoc.status,
        url: assoc.details_url,
      },
      source: {
        kind: "official-register",
        name: "Consumer Affairs Victoria incorporated associations register",
        url: assoc.details_url,
        retrieved: "2026-08-29",
        note: assoc.note || "Legal name, number and status only.",
      },
      verification: enrichment.verification || { lastReviewedAt: "2026-08-29" },
      schema_type: enrichment.schema_type || ENTITY_TYPES[entityType]?.schema,
    },
    { section, entityType }
  );
}

export function assembleEntities(sources) {
  const bySlug = new Map();

  const add = (entity) => {
    if (!entity?.slug) return;
    bySlug.set(entity.slug, entity);
  };

  for (const raw of sources.food || []) {
    add(normalizeListing(raw, { section: "eat-drink", entityType: "business" }));
  }
  for (const raw of sources.stay || []) {
    add(normalizeListing(raw, { section: "stay", entityType: "business" }));
  }
  for (const raw of sources.doSee || []) {
    const shop = SHOP_SLUGS.has(raw.slug);
    add(
      normalizeListing(raw, {
        section: shop ? "services" : "do-see",
        entityType: "business",
      })
    );
  }
  for (const raw of sources.community || []) {
    add(normalizeListing(raw, { section: "community" }));
  }
  for (const raw of sources.services || []) {
    add(normalizeListing(raw, { section: "services" }));
  }

  const enrichment = sources.enrichment || {};
  for (const assoc of sources.associations || []) {
    if (assoc.status !== "Registered") continue;
    add(associationToEntity(assoc, enrichment[assoc.number] || {}));
  }

  // Submitted or claimed updates overlay the seed. Same slug wins.
  for (const raw of sources.submitted || []) {
    add(normalizeListing(raw, {}));
  }

  const entities = [...bySlug.values()];
  const extraRelated = {
    "mallacoota-golf-club-bistro": ["mallacoota-golf-and-country-club"],
    "mallacoota-rsl-bunker-museum": ["mallacoota-and-district-historical-society"],
    "mallacoota-marine-search-and-rescue": ["australian-volunteer-coast-guard-vf15"],
    "australian-volunteer-coast-guard-vf15": ["mallacoota-marine-search-and-rescue"],
  };
  for (const entity of entities) {
    const extra = extraRelated[entity.slug];
    if (!extra) continue;
    entity.related = [...new Set([...(entity.related || []), ...extra])];
  }

  return entities.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export function entitiesForSection(entities, sectionId) {
  return entities.filter((entity) => entity.section === sectionId && entity.status !== "hidden");
}

export function entityBySlug(entities, slug) {
  return entities.find((entity) => entity.slug === slug) || null;
}

export function relatedEntities(entities, entity) {
  const slugs = new Set(entity.related || []);
  return entities.filter((candidate) => slugs.has(candidate.slug));
}

/*
 * Page metadata for a listing, composed from the record rather than from a
 * template. Ninety-eight listings previously shared one pattern — the name plus
 * the site's name, and whatever short description happened to be on file, which
 * ran from nineteen characters to two hundred and sixty-three. Neither told a
 * search result what the thing was or where it was.
 *
 * Nothing here is invented. Every clause is dropped when the field behind it is
 * missing, so a sparse listing gets a short description rather than a padded one.
 */

/** Trim to a length without cutting a word or leaving dangling punctuation. */
function clamp(text, limit) {
  const value = String(text).replace(/\s+/g, " ").trim();
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit - 1);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  // A sentence boundary in the back half of the allowance beats a word boundary.
  if (stop > limit * 0.5) return cut.slice(0, stop + 1).trim();
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\-–—]$/, "").trim()}...`;
}

/**
 * Umbrella tags. They are useful as filter buttons on a category page, where
 * the reader is choosing between them, and useless in a page title, where they
 * describe a shelf rather than the thing on it.
 */
const BROAD_TAG = ALL_FILTERS;

/** Short enough for a title, where the ENTITY_TYPES labels are not. */
const KIND_BY_TYPE = {
  business: "Business",
  trade: "Trade service",
  professional: "Professional service",
  "community-organisation": "Community group",
  "sporting-club": "Sports club",
  "social-group": "Social group",
  arts: "Arts organisation",
  government: "Public service",
  school: "School",
  church: "Church",
  emergency: "Emergency service",
  media: "Local media",
  "community-facility": "Community facility",
  "facebook-group": "Community Facebook group",
  other: "Listing",
};

/** What this listing is, in as few words as the record supports. */
export function listingKind(entity) {
  // The listing's own word for itself wins: a bakery is a bakery, however it
  // is filed. Only then the tags, and only a tag narrow enough to be worth
  // saying, which since the filters shrank means a tag from an older record.
  if (entity.kind) return entity.kind;
  const specific = displayTags(entity).find((tag) => !BROAD_TAG.has(tag));
  if (specific) return specific;
  return KIND_BY_TYPE[entity.entityType] || displayTags(entity)[0] || "Listing";
}

/**
 * "Mallacoota Bakery — Bakery in Mallacoota". Where the name already carries
 * the town, the trailing "in Mallacoota" is dropped rather than repeated, and a
 * name long enough to fill a search result keeps the town and loses the kind.
 */
export function listingTitle(entity) {
  const kind = listingKind(entity);
  const carriesTown = /mallacoota/i.test(entity.name);
  // Naming the town twice in one title helps nobody, so a name that already
  // carries it falls back to itself rather than to "… — Mallacoota".
  const candidates = carriesTown
    ? [`${entity.name} - ${kind}`, entity.name]
    : [`${entity.name} - ${kind} in Mallacoota`, `${entity.name} - Mallacoota`, entity.name];
  return candidates.find((candidate) => candidate.length <= 62) || clamp(entity.name, 60);
}

/**
 * The listing's own words first, then where it is, then what the page adds.
 * The last clause is the only editorial one, and it describes the page rather
 * than the business.
 */
export function listingDescription(entity, { limit = 155 } = {}) {
  const own = entity.descriptionShort || entity.description || "";
  const parts = [];
  if (own) parts.push(clamp(own, limit - 30));

  const where = formatAddress(entity.address);
  const kind = listingKind(entity);
  if (where) {
    parts.push(`${kind} at ${where}.`);
  } else if (entity.serviceArea) {
    parts.push(`${kind} serving ${entity.serviceArea}.`);
  } else if (!own) {
    parts.push(`${kind} in Mallacoota.`);
  }

  if (entity.meetingTimes) parts.push(`Meets ${entity.meetingTimes}.`);

  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  const tail = isOfficialEntity(entity)
    ? "Official contact details on Love Mallacoota."
    : (entity.openingHours || entity.opening_hours || []).length
      ? "Contact details, opening hours and links on Love Mallacoota."
      : "Contact details and links on Love Mallacoota.";

  // The tail earns its place only when there is room for all of it.
  if (joined.length + tail.length + 1 <= limit) return `${joined} ${tail}`;
  return clamp(joined || `${entity.name} in Mallacoota.`, limit);
}
