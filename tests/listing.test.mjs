import assert from "node:assert/strict";
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
      { TURNSTILE_SECRET_KEY: "secret", DB: {} }
    );
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error, /Official/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
