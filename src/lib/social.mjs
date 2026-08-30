/*
# Project:     lovemallacoota.au
# File Name:   social.mjs
# Description: Which 1200 x 630 card a page shares. The cards themselves are
#              rendered by tools/build-og.mjs and committed; this file only
#              decides which one a page points at, and never invents a path.
#
# A share card is the whole of what most people see of this site on Facebook,
# so a page without a card of its own falls back to the card for the thing it
# belongs to — a listing to its directory section, an edition to the weekly
# card — rather than to one generic logo picture for the entire site.
*/

export const OG_DIR = "/images/og";

/** Cards that exist as files. Keep in step with FIXED_CARDS in tools/build-og.mjs. */
export const CARDS = {
  home: `${OG_DIR}/home.jpg`,
  edition: `${OG_DIR}/edition.jpg`,
  calendar: `${OG_DIR}/calendar.jpg`,
  directory: `${OG_DIR}/directory.jpg`,
  food: `${OG_DIR}/food.jpg`,
  accom: `${OG_DIR}/accom.jpg`,
  activity: `${OG_DIR}/activity.jpg`,
  community: `${OG_DIR}/community.jpg`,
  services: `${OG_DIR}/services.jpg`,
  archive: `${OG_DIR}/archive.jpg`,
  emergency: `${OG_DIR}/emergency.jpg`,
  "add-listing": `${OG_DIR}/add-listing.jpg`,
};

/** Directory section id to the card for that section. */
const SECTION_CARDS = {
  "eat-drink": CARDS.food,
  stay: CARDS.accom,
  "do-see": CARDS.activity,
  community: CARDS.community,
  services: CARDS.services,
};

export const DEFAULT_CARD = CARDS.home;

/**
 * The card for a listing: its own approved photograph if there is one, else the
 * card for its part of the directory. Never a blank or a bare logo.
 */
export function listingCard(entity, photoUrl) {
  if (photoUrl) return photoUrl;
  return SECTION_CARDS[entity?.section] || CARDS.directory;
}

/**
 * The card for an edition. Frozen per week if tools/build-og.mjs has rendered
 * one, so a share posted months ago still shows the picture it was posted with.
 * `available` is the set of rendered filenames, passed in by the caller because
 * only the build has a filesystem.
 */
export function editionCard(week, available) {
  const name = `edition-${week}.jpg`;
  if (available?.has(name)) return `${OG_DIR}/${name}`;
  return CARDS.edition;
}

/** Alt text, so the card is described rather than announced as an image. */
export function cardAlt(title) {
  return `${title} — Love Mallacoota`;
}
