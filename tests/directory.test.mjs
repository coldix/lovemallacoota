import assert from "node:assert/strict";
import test from "node:test";

import {
  SHOP_SLUGS,
  canClaim,
  entityBySlug,
  isOfficialEntity,
  loadDirectory,
  schemaTypeFor,
  sectionCounts,
  sectionEntities,
  verificationLine,
} from "../src/lib/directory.mjs";
import { displayAssociationName, slugify } from "../src/lib/directory-model.mjs";

const directory = loadDirectory();

test("every listing has a unique slug and a name", () => {
  const slugs = directory.map((entity) => entity.slug);
  assert.equal(new Set(slugs).size, slugs.length, "duplicate directory slugs");
  for (const entity of directory) {
    assert.ok(entity.name, `${entity.slug} has no name`);
    assert.ok(entity.section, `${entity.slug} has no section`);
    assert.ok(entity.entityType, `${entity.slug} has no entity type`);
  }
});

test("shops sit in Services, not Do & See", () => {
  for (const slug of SHOP_SLUGS) {
    const entity = entityBySlug(slug);
    assert.ok(entity, `missing shop ${slug}`);
    assert.equal(entity.section, "services", `${slug} should be in services`);
  }
  const activity = sectionEntities("do-see");
  for (const slug of SHOP_SLUGS) {
    assert.equal(
      activity.some((entity) => entity.slug === slug),
      false,
      `${slug} leaked into Do & See`
    );
  }
});

test("official government and emergency listings cannot be claimed", () => {
  const police = entityBySlug("mallacoota-police-station");
  const shire = entityBySlug("east-gippsland-shire-council");
  const cfa = entityBySlug("cfa-mallacoota-fire-brigade");
  for (const entity of [police, shire, cfa]) {
    assert.ok(entity, "missing official listing");
    assert.equal(isOfficialEntity(entity), true);
    assert.equal(canClaim(entity), false);
    assert.notEqual(schemaTypeFor(entity), "LocalBusiness");
  }
});

test("deregistered associations are not published", () => {
  assert.equal(entityBySlug("mallacoota-coast-guard"), null);
  assert.equal(entityBySlug("mallacoota-sailing-club"), null);
  assert.ok(!directory.some((entity) => entity.registration?.number === "A0061544D"));
});

test("CAV seed listings do not invent phone numbers", () => {
  const club = directory.find((entity) => entity.registration?.number === "A0108697L");
  assert.ok(club, "Car and Bike Club should be seeded from the register");
  assert.equal(club.phone, null);
  assert.equal(club.email, null);
  assert.match(verificationLine(club).text, /Consumer Affairs Victoria/);
  assert.equal(verificationLine(club).verified, false);
});

test("verified public sources keep their contact details", () => {
  const radio = entityBySlug("3mgb-wilderness-radio");
  const madra = entityBySlug("madra");
  const health = entityBySlug("mallacoota-district-health-and-support-service");
  assert.equal(radio.website, "https://www.3mgb.org.au/");
  assert.equal(madra.email, "madra.3892@gmail.com");
  assert.equal(health.phone, "03 5158 0243");
});

test("the golf club and the bistro are linked, not duplicated", () => {
  const club = entityBySlug("mallacoota-golf-and-country-club");
  const bistro = entityBySlug("mallacoota-golf-club-bistro");
  assert.ok(club && bistro);
  assert.equal(club.section, "community");
  assert.equal(bistro.section, "eat-drink");
  assert.ok(club.related.includes("mallacoota-golf-club-bistro"));
  assert.ok(bistro.related.includes("mallacoota-golf-and-country-club"));
});

test("association research supplies contacts without inventing them", () => {
  const friends = entityBySlug("friends-of-mallacoota");
  assert.equal(friends.email, "friendsofmallacoota@gmail.com");
  assert.equal(friends.website, "https://friendsofmallacoota.com.au/");
  const tools = entityBySlug("mallacoota-and-district-tool-library-madtl");
  assert.equal(tools.website, "https://madtl.org.au/");
});

test("operational marine rescue is Coast Guard VF15, not MMSAR", () => {
  const rescue = entityBySlug("australian-volunteer-coast-guard-vf15");
  const proposal = entityBySlug("mallacoota-marine-search-and-rescue");
  assert.ok(rescue, "missing VF15");
  assert.equal(rescue.official, true);
  assert.equal(canClaim(rescue), false);
  assert.match(proposal.description, /not operational/i);
});

test("local council counter, transfer station and water faults are listed", () => {
  assert.ok(entityBySlug("mallacoota-service-centre-and-library"));
  assert.ok(entityBySlug("mallacoota-transfer-station"));
  assert.equal(entityBySlug("east-gippsland-water").phone, "1800 671 841");
});

test("CHIRF and the firefighters fund are not presented as the service they fundraise for", () => {
  const chirf = entityBySlug("chirf");
  const fund = entityBySlug("mallacoota-volunteer-fire-fighters-fund");
  assert.match(chirf.description, /not a clinic/i);
  assert.match(fund.description, /not the CFA/i);
});

test("community and services are first-class sections with real records", () => {
  const counts = sectionCounts();
  assert.ok(counts.community > 20, `community is too thin: ${counts.community}`);
  assert.ok(counts.services > 10, `services is too thin: ${counts.services}`);
});

test("association display names are readable without shouting", () => {
  assert.equal(
    displayAssociationName("LIONS CLUB OF MALLACOOTA & DISTRICT INC."),
    "Lions Club of Mallacoota & District"
  );
  assert.equal(slugify("3MGB Wilderness Radio"), "3mgb-wilderness-radio");
});

test("a verification date is never invented, and never in the future", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const entity of directory) {
    const verifiedAt = entity.verification?.email?.verifiedAt;
    if (verifiedAt) {
      assert.match(verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${entity.name}: bad date`);
      assert.ok(verifiedAt <= today, `${entity.name} verified in the future`);
    }
    assert.notEqual(entity.verification?.mobile?.verified, true, `${entity.name} claims a verified mobile`);
  }
});
