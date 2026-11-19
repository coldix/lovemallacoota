import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
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

test("verified Access identities are authorised only for their admin routes", async (t) => {
  const team = "test-team.cloudflareaccess.com";
  const audience = "admin-app";
  const serviceId = "pending-queue.access";
  const locked = {
    ...env,
    CF_ACCESS_TEAM_DOMAIN: team,
    CF_ACCESS_AUD: audience,
    LM_PENDING_SERVICE_TOKEN_ID: serviceId,
  };
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "admin-test-key";
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, `https://${team}/cdn-cgi/access/certs`);
    return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid }] });
  });

  const claims = { iss: `https://${team}`, aud: [audience], exp: Math.floor(Date.now() / 1000) + 60 };
  const serviceClaims = { type: "app", sub: "", common_name: serviceId };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = (identity) => {
    const input = `${encode({ alg: "RS256", kid })}.${encode({ ...claims, ...identity })}`;
    return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
  };
  const serviceJwt = jwt(serviceClaims);
  const personJwt = jwt({ email: "Coota@LoveMallacoota.au", sub: "test-person" });
  const pending = "/api/admin/pending";

  await t.test("the configured service token can read the queue", async () => {
    const row = { id: "entry", payload: "{}", status: "held" };
    const DB = {
      prepare(query) {
        assert.match(query, /^SELECT .* FROM submissions WHERE status IN /);
        return { all: async () => ({ results: [row] }) };
      },
    };
    const response = await worker.fetch(adminRequest(pending, { jwt: serviceJwt }), {
      ...locked,
      ADMIN_EMAILS: undefined,
      DB,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      submissions: [{ id: "entry", status: "held", data: {} }],
    });
  });

  await t.test("the service token cannot use the dashboard, HEAD, or other admin routes", async () => {
    const routes = [
      [pending, "HEAD"],
      ["/api/admin/approve", "POST"],
      ["/api/admin/reject", "POST"],
      ["/api/admin/other", "GET"],
      ["/admin.html", "GET"],
    ];
    for (const [path, method] of routes) {
      const response = await worker.fetch(adminRequest(path, { jwt: serviceJwt, method }), locked);
      assert.equal(response.status, 401, `${method} ${path}`);
    }
    const approve = adminRequest("/api/admin/approve", {
      jwt: jwt({ ...serviceClaims, email: "coota@lovemallacoota.au" }),
      method: "POST",
    });
    assert.equal((await worker.fetch(approve, locked)).status, 401);
  });

  await t.test("allow-listed people can still read and moderate", async () => {
    for (const [path, method] of [[pending, "GET"], [pending, "HEAD"], ["/admin.html", "GET"]]) {
      const response = await worker.fetch(adminRequest(path, { jwt: personJwt, method }), locked);
      assert.equal(response.status, 200, `${method} ${path}`);
    }
    const DB = {
      prepare(query) {
        return {
          bind() {
            if (query.startsWith("SELECT ")) {
              return { first: async () => ({ kind: "listing", payload: "{}" }) };
            }
            assert.match(query, /^UPDATE submissions SET status = '(approved|rejected)'/);
            return { run: async () => ({}) };
          },
        };
      },
    };
    for (const path of ["/api/admin/approve", "/api/admin/reject"]) {
      const request = new Request(`https://lovemallacoota.au${path}`, {
        method: "POST",
        headers: { "Cf-Access-Jwt-Assertion": personJwt },
        body: JSON.stringify({ id: "entry" }),
      });
      assert.equal((await worker.fetch(request, { ...locked, DB })).status, 200, path);
    }
    const outsider = adminRequest(pending, { jwt: jwt({ email: "outsider@example.com" }) });
    assert.equal((await worker.fetch(outsider, locked)).status, 401);
  });

  await t.test("missing, invalid, and unconfigured service credentials fail closed", async () => {
    const [header, payload, signature] = serviceJwt.split(".");
    const modifiedSignature = Buffer.from(signature, "base64url");
    modifiedSignature[0] ^= 1;
    const rejected = [
      undefined,
      "malformed",
      `${header}.${payload}.${modifiedSignature.toString("base64url")}`,
      jwt({ ...serviceClaims, aud: ["another-app"] }),
      jwt({ ...serviceClaims, iss: "https://another-team.cloudflareaccess.com" }),
      jwt({ ...serviceClaims, exp: claims.exp - 120 }),
      jwt({ ...serviceClaims, common_name: "other-queue.access" }),
    ];
    for (const token of rejected) {
      const request = adminRequest(pending, { jwt: token, email: "coota@lovemallacoota.au" });
      assert.equal((await worker.fetch(request, locked)).status, 401);
    }
    const request = adminRequest(pending, { jwt: serviceJwt });
    for (const changes of [{ LM_PENDING_SERVICE_TOKEN_ID: undefined }, { CF_ACCESS_AUD: undefined }]) {
      assert.equal((await worker.fetch(request, { ...locked, ...changes })).status, 401);
    }
  });
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
