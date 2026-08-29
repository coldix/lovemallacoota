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
  // Line breaks inside a block are kept, because a bullet list is one block of
  // several lines. The renderer folds them away for ordinary prose.
  assert.deepEqual(body, ["First para.\nStill first.", "Second para."]);
  assert.equal(renderBlock(body[0]), "<p>First para. Still first.</p>");
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
