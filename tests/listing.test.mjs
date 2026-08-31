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
