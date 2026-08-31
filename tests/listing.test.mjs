import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { handleListingSubmit, handleListingVerify } from "../src/listing.ts";

test("listing APIs only accept POST for submit and verify", async () => {
  const submit = await handleListingSubmit(new Request("https://lovemallacoota.au/api/listing"), {});
  assert.equal(submit.status, 405);
  const verify = await handleListingVerify(new Request("https://lovemallacoota.au/api/listing/verify"), {});
  assert.equal(verify.status, 405);
});

test("listing submit fails closed without Turnstile", async () => {
  const body = new FormData();
  body.set("kind", "add");
  const response = await handleListingSubmit(
    new Request("https://lovemallacoota.au/api/listing", { method: "POST", body }),
    {}
  );
  assert.equal(response.status, 503);
});

test("government entities cannot be added through the public form", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
  try {
    const body = new FormData();
    body.set("kind", "add");
    body.set("entityType", "government");
    body.set("name", "Fake Shire");
    body.set("email", "someone@example.com");
    body.set("authorised", "yes");
    body.set("description", "No");
    body.set("cf-turnstile-response", "token");
    const response = await handleListingSubmit(
      new Request("https://lovemallacoota.au/api/listing", { method: "POST", body }),
      // A realistic Worker: configured to send, so validation errors surface
      // rather than being masked by the mailer guard.
      { TURNSTILE_SECRET_KEY: "secret", DB: {}, RESEND_API_KEY: "re_test", MAIL_FROM: "t@example.com" }
    );
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error, /Official/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a verification code goes to the person, never to the site's own inbox", async () => {
  // The relay sends to one fixed address by design, so every code sent through
  // it landed at coota@lovemallacoota.au instead of with the person waiting for
  // it — and Email Routing behind it cannot reach an unverified stranger at all.
  const source = await readFile(new URL("../src/listing.ts", import.meta.url), "utf8");

  // Each of the three code sends must use the mailer, addressed to the submitter.
  const codeSends = [...source.matchAll(/const mailed = await (\w+)\(env,\s*(\w+)?/g)];
  assert.equal(codeSends.length, 3, "expected three confirmation-code sends");
  for (const [, fn, arg] of codeSends) {
    assert.equal(fn, "sendCode", "a code is being sent through the relay");
    assert.equal(arg, "email", "a code is not addressed to the submitter");
  }

  // And a submission must be refused before anything is written when no code
  // could be delivered, rather than stored in a state nobody can complete.
  assert.match(
    source,
    /if \(!canSendToPeople\(env\)\)/,
    "submissions are accepted even when no code can be sent"
  );
});

test("the Worker can find a listing that was added through the form", async () => {
  // The five listing JSON files are bundled into the Worker at deploy time.
  // Anything submitted since lives under data/directory/, which the Worker
  // itself wrote — and it was not looking there. Claiming your own new listing
  // answered "We could not find that listing", no event could be attached to
  // one, and a duplicate slug did not register as a duplicate.
  const source = await readFile(new URL("../src/listing.ts", import.meta.url), "utf8");

  assert.match(source, /async function findEntity/, "no lookup that reaches submitted listings");
  assert.match(
    source,
    /data\/directory\/\$\{slug\}\.json/,
    "findEntity does not read the submitted listing files"
  );
  // The slug reaches a URL.
  assert.match(source, /\^\[a-z0-9-\]\{1,120\}\$/, "the slug is not validated before it reaches a URL");

  // Exactly one search of the bundle is allowed: the fast path inside
  // findEntity itself. A second one is a caller that will miss submitted
  // listings, which is the bug this guards.
  const findEntityBody = source.slice(
    source.indexOf("async function findEntity"),
    source.indexOf("function requireDb")
  );
  const allBundled = [...source.matchAll(/directoryEntities\(\)\.find\(/g)].length;
  const insideFindEntity = [...findEntityBody.matchAll(/directoryEntities\(\)\.find\(/g)].length;
  assert.equal(insideFindEntity, 1, "findEntity no longer checks the bundle first");
  assert.equal(
    allBundled,
    1,
    "a caller still searches only the bundled listings and will miss submitted ones"
  );
});

test("an owner who proved their address is recorded as verified", async () => {
  // A manage token is only issued after a code sent to the address published on
  // the listing was entered correctly — that is email verification. The update
  // used to record only lastReviewedAt, so the one listing on the site that had
  // actually proved control of its address still read "Not yet verified", which
  // is the whole visible point of claiming it.
  const source = await readFile(new URL("../src/listing.ts", import.meta.url), "utf8");
  const manage = source.slice(source.indexOf("export async function handleListingManage"));

  assert.match(manage, /const verifiedAddress = String\(row\.email/, "the token's address is not read");
  assert.match(
    manage,
    /verifiedAddress && nextEmail === verifiedAddress/,
    "verification does not check the edit kept the address that was proved"
  );
  assert.match(
    manage,
    /verifiedAt: melbourneDate\(\)/,
    "a proved address is still never recorded as verified"
  );
  // Changing the address in the same edit must not inherit the old proof.
  assert.match(
    manage,
    /: \{ value: nextEmail, verifiedAt: null, method: "emailed-code" \}/,
    "a changed address would be claimed as verified without being proved"
  );
});
