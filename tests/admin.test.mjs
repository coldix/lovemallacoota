import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isAdmin, parseAdminEmails } from "../src/admin.ts";
import worker from "../src/worker.ts";

const env = {
  ASSETS: {
    async fetch(request) {
      return new Response(`asset:${new URL(request.url).pathname}`, {
        headers: { "Content-Type": "text/plain" },
      });
    },
  },
  ADMIN_EMAILS: "coota@lovemallacoota.au, col@dixon.net.au",
};

const adminRequest = (path, { method = "GET", email, key, jwt } = {}) => {
  const url = new URL(path, "https://lovemallacoota.au");
  if (key) url.searchParams.set("key", key);
  const headers = {};
  if (email) headers["Cf-Access-Authenticated-User-Email"] = email;
  if (jwt) headers["Cf-Access-Jwt-Assertion"] = jwt;
  return new Request(url, { method, headers });
};

test("the admin allow-list is exact addresses, not a substring", () => {
  const allowed = parseAdminEmails("coota@lovemallacoota.au, col@dixon.net.au");
  assert.equal(allowed.has("coota@lovemallacoota.au"), true);
  assert.equal(allowed.has("col@dixon.net.au"), true);
  assert.equal(allowed.has("notdixon@example.com"), false);
  assert.equal(allowed.has("someone@coota.com"), false);
  assert.equal(parseAdminEmails(undefined).size, 0);
  assert.equal(parseAdminEmails("").size, 0);
});

test("admin routes reject a caller with no credentials", async () => {
  const response = await worker.fetch(adminRequest("/api/admin/pending"), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(Object.hasOwn(body, "submissions"), false);
});

test("a spoofed email that only resembles an admin is refused", async () => {
  const response = await worker.fetch(
    adminRequest("/api/admin/pending", { email: "notdixon@example.com" }),
    env
  );
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(Object.hasOwn(body, "submissions"), false);
});

test("the old query-string key no longer opens the dashboard", async () => {
  const response = await worker.fetch(
    adminRequest("/api/admin/pending", { key: "abcdefghijklmnop" }),
    env
  );
  assert.equal(response.status, 401);
});

test("an allow-listed Access email may read the empty queue", async () => {
  const response = await worker.fetch(
    adminRequest("/api/admin/pending", { email: "Coota@LoveMallacoota.au" }),
    env
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.submissions, []);
});

test("admin access fails closed when the allow-list is unset", async () => {
  const { ADMIN_EMAILS, ...rest } = env;
  assert.equal(
    await isAdmin(adminRequest("/api/admin/pending", { email: "coota@lovemallacoota.au" }), rest),
    false
  );
  const response = await worker.fetch(
    adminRequest("/api/admin/pending", { email: "coota@lovemallacoota.au" }),
    rest
  );
  assert.equal(response.status, 401);
});

test("when JWT verification is configured, the email header alone is not enough", async () => {
  const locked = {
    ...env,
    CF_ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
    CF_ACCESS_AUD: "test-audience",
  };
  const response = await worker.fetch(
    adminRequest("/api/admin/pending", { email: "coota@lovemallacoota.au" }),
    locked
  );
  assert.equal(response.status, 401);
});

test("approve and reject answer GET with 405 rather than 500", async () => {
  for (const path of ["/api/admin/approve", "/api/admin/reject"]) {
    const response = await worker.fetch(adminRequest(path), env);
    assert.equal(response.status, 405, `${path} should be 405`);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /POST/);
  }
});

test("unauthenticated approve and reject POSTs are 401, not 500", async () => {
  for (const path of ["/api/admin/approve", "/api/admin/reject"]) {
    const response = await worker.fetch(
      new Request(`https://lovemallacoota.au${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "example" }),
      }),
      env
    );
    assert.equal(response.status, 401, `${path} should be 401`);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
  }
});

test("POST-only API routes return 405 with a noindex robots tag", async () => {
  const response = await worker.fetch(new Request("https://lovemallacoota.au/api/article"), env);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
});

test("robots.txt tells crawlers to stay out of /api/", () => {
  const robots = readFileSync(new URL("../robots.txt", import.meta.url), "utf8");
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, /Sitemap: https:\/\/lovemallacoota\.au\/sitemap\.xml/);
});
