import assert from "node:assert/strict";
import test from "node:test";

import {
  accessEmail,
  checkAgainstPolicy,
  findContributor,
  slugify,
  toParagraphs,
} from "../src/submit.ts";
import { renderBlock } from "../src/lib/markup.mjs";

const withEmail = (email) =>
  new Request("https://lovemallacoota.au/api/article", {
    method: "POST",
    headers: email ? { "Cf-Access-Authenticated-User-Email": email } : {},
  });

test("identity comes from Access, not from the form", () => {
  assert.equal(accessEmail(withEmail("Sue@Example.com")), "sue@example.com");
  assert.equal(accessEmail(withEmail("")), null);
  assert.equal(accessEmail(withEmail(null)), null);
});

test("only an approved, active contributor may publish", () => {
  assert.ok(findContributor("coota@lovemallacoota.au"));
  assert.equal(findContributor("someone@example.com"), null);
});

test("paragraphs survive the trip, blank lines do not", () => {
  const body = toParagraphs("First para.\nStill first.\n\n\nSecond para.\n\n   \n");
  // Line breaks inside a block are kept: a bullet list is one block of several
  // lines, and a verse or an address is set out the way it was typed.
  assert.deepEqual(body, ["First para.\nStill first.", "Second para."]);
  assert.equal(renderBlock(body[0]), "<p>First para.<br />Still first.</p>");
});

test("a bullet list typed into the form survives as a list", () => {
  const [block] = toParagraphs("- Bread\n- Milk\n- Bait");
  assert.equal(
    renderBlock(block),
    '<ul class="edition-list"><li>Bread</li><li>Milk</li><li>Bait</li></ul>'
  );
});

test("headlines become safe ids", () => {
  assert.equal(
    slugify("From the mud of the Barwon: Frank Stokes' deep-water days"),
    "from-the-mud-of-the-barwon-frank-stokes-deep-water-days"
  );
});

test("a policy check that cannot run holds rather than publishes", async () => {
  const unchecked = await checkAgainstPolicy({}, "anything");
  assert.equal(unchecked.verdict, "unchecked");

  const broken = await checkAgainstPolicy(
    { AI: { async run() { throw new Error("model unavailable"); } } },
    "anything"
  );
  assert.equal(broken.verdict, "hold");
});

test("the check reads a verdict out of the model's reply", async () => {
  const pass = await checkAgainstPolicy(
    { AI: { async run() { return { response: 'Sure: {"verdict":"pass"}' }; } } },
    "The bowls club meets Tuesday."
  );
  assert.equal(pass.verdict, "pass");

  const hold = await checkAgainstPolicy(
    {
      AI: {
        async run() {
          return { response: '{"verdict":"hold","clause":"unverified allegations","reason":"Names a person"}' };
        },
      },
    },
    "..."
  );
  assert.equal(hold.verdict, "hold");
  assert.equal(hold.clause, "unverified allegations");
});

test("a classified without a way to reply is refused", async () => {
  const { needsContact } = await import("../src/submit.ts");
  // The rule lives in the handler; this asserts the sections it applies to.
  assert.ok(needsContact("classifieds"));
  assert.ok(needsContact("bdm"));
  assert.ok(needsContact("positions"));
  assert.ok(!needsContact("editorial"));
  assert.ok(!needsContact("community"));
});

test("every contributor has a real address and only sections that exist", async () => {
  // A typo in a section id fails silently: the contributor keeps their account,
  // the form offers the section, and the submission is refused at the last step
  // with no indication of why.
  const { SECTIONS } = await import("../src/lib/editions.mjs");
  const { readFile } = await import("node:fs/promises");
  const contributors = JSON.parse(
    await readFile(new URL("../data/contributors.json", import.meta.url), "utf8")
  );
  const offered = new Set(SECTIONS.filter((section) => !section.automatic).map((s) => s.id));

  assert.ok(contributors.length > 0, "no contributors at all");
  for (const person of contributors) {
    assert.match(person.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/, `${person.email}: not an address`);
    assert.equal(person.email, person.email.toLowerCase(), `${person.email}: lookup lowercases, this will never match`);
    assert.ok(person.name, `${person.email}: no name, so no byline`);
    assert.ok(person.sections.length > 0, `${person.email}: approved for nothing`);
    for (const section of person.sections) {
      assert.ok(offered.has(section), `${person.email}: "${section}" is not a section anyone can submit to`);
    }
  }
  const emails = contributors.map((p) => p.email);
  assert.equal(new Set(emails).size, emails.length, "the same address is listed twice");
});

test("the same piece cannot be committed to an edition twice", async () => {
  const { appendArticle } = await import("../src/submit.ts");
  const edition = { articles: [{ id: "w1-a", title: "Farewell to Barbara (2009)" }] };
  assert.throws(() => appendArticle(edition, { id: "w1-a", title: "Other" }), /already/);
  assert.throws(() => appendArticle(edition, { id: "w1-b", title: "farewell to barbara 2009" }), /already/);
  appendArticle(edition, { id: "w1-c", title: "Something else" });
  assert.equal(edition.articles.length, 2);
});
