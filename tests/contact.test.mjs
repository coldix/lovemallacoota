import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { handleContactSubmit } from "../src/contact.ts";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RELAY_URL = "https://ads.oze.net.au/relay";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Stub both outbound calls: the Turnstile check and the relay hop. */
function stubFetch({ turnstileOk = true, relayStatus = 200 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const href = typeof url === "string" ? url : url.url;
    calls.push({ href, init });
    if (href === SITEVERIFY) {
      return new Response(JSON.stringify({ success: turnstileOk }), { status: 200 });
    }
    if (href === RELAY_URL) {
      return new Response(relayStatus === 200 ? '{"ok":true}' : "no", { status: relayStatus });
    }
    throw new Error(`unexpected fetch to ${href}`);
  };
  return calls;
}

function env(overrides = {}) {
  return {
    TURNSTILE_SECRET_KEY: "0xSECRET",
    RELAY_KEY: "relay-key",
    RELAY_URL,
    ...overrides,
  };
}

function submit(fields = {}, method = "POST") {
  const body = new FormData();
  const defaults = {
    business: "Alf’s Pizza",
    user_name: "A Visitor",
    user_email: "visitor@example.com",
    notes: "New opening hours",
    "cf-turnstile-response": "token",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...fields })) {
    if (value !== null) body.append(key, value);
  }
  return method === "POST"
    ? new Request("https://lovemallacoota.au/api/submit", { method, body })
    : new Request("https://lovemallacoota.au/api/submit", { method });
}

test("only accepts POST", async () => {
  const response = await handleContactSubmit(submit({}, "GET"), env());
  assert.equal(response.status, 405);
});

test("fails closed when Turnstile is not configured", async () => {
  const response = await handleContactSubmit(submit(), env({ TURNSTILE_SECRET_KEY: undefined }));
  assert.equal(response.status, 503);
});

test("rejects a submission that fails the Turnstile check", async () => {
  const calls = stubFetch({ turnstileOk: false });
  const response = await handleContactSubmit(submit(), env());
  assert.equal(response.status, 403);
  assert.equal(calls.filter((call) => call.href === RELAY_URL).length, 0);
});

test("swallows a honeypot submission without relaying it", async () => {
  const calls = stubFetch();
  const response = await handleContactSubmit(submit({ website: "http://spam.example" }), env());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.length, 0);
});

test("requires the mandatory fields and a plausible email", async () => {
  stubFetch();
  assert.equal((await handleContactSubmit(submit({ business: null }), env())).status, 400);
  stubFetch();
  assert.equal((await handleContactSubmit(submit({ user_email: "nope" }), env())).status, 400);
});

test("relays a valid submission with the visitor as reply-to", async () => {
  const calls = stubFetch();
  const response = await handleContactSubmit(submit(), env());
  assert.equal(response.status, 200);

  const relayed = calls.find((call) => call.href === RELAY_URL);
  assert.ok(relayed, "the submission was not relayed");
  assert.equal(relayed.init.headers.Authorization, "Bearer relay-key");

  const payload = JSON.parse(relayed.init.body);
  assert.equal(payload.site, "lovemallacoota");
  assert.equal(payload.replyTo, "visitor@example.com");
  assert.match(payload.subject, /Alf/);
  assert.match(payload.text, /New opening hours/);
});

test("reports a relay failure instead of claiming the update was sent", async () => {
  stubFetch({ relayStatus: 502 });
  const response = await handleContactSubmit(submit(), env());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).ok, false);
});

test("fails closed when the relay key is missing", async () => {
  stubFetch();
  const response = await handleContactSubmit(submit(), env({ RELAY_KEY: undefined }));
  assert.equal(response.status, 503);
});
