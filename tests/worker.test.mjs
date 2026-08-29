import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.ts";
import { pdfFilename, weekFromPath } from "../src/edition-pdf.ts";

const env = {
  ASSETS: {
    async fetch(request) {
      return new Response(`asset:${new URL(request.url).pathname}`, {
        headers: { "Content-Type": "text/plain" },
      });
    },
  },
};

test("redirects every legacy hostname and preserves the path and query", async () => {
  for (const hostname of [
    "www.lovemallacoota.au",
    "lovemallacoota.com.au",
    "www.lovemallacoota.com.au",
    "lovemallacoota.com",
    "www.lovemallacoota.com",
  ]) {
    const response = await worker.fetch(
      new Request(`https://${hostname}/calendar.html?source=old`),
      env
    );
    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("Location"),
      "https://lovemallacoota.au/calendar.html?source=old"
    );
  }
});

test("redirects old WordPress paths on the canonical hostname", async () => {
  const response = await worker.fetch(
    new Request("https://lovemallacoota.au/eat-drink/?ref=archive"),
    env
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("Location"),
    "https://lovemallacoota.au/food.html?ref=archive"
  );
});

test("redirects the archive clean URL to the static archive page", async () => {
  const response = await worker.fetch(
    new Request("https://lovemallacoota.au/archive"),
    env
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("Location"),
    "https://lovemallacoota.au/archive.html"
  );
});

test("community and services clean URLs redirect to the html pages", async () => {
  const community = await worker.fetch(new Request("https://lovemallacoota.au/community"), env);
  assert.equal(community.status, 301);
  assert.equal(community.headers.get("Location"), "https://lovemallacoota.au/community.html");
});

test("individual listing pages are served, not sent home", async () => {
  const response = await worker.fetch(
    new Request("https://lovemallacoota.au/listing/madra.html"),
    env
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset:/listing/madra.html");
});

test("collapses a legacy hostname and old path into one redirect", async () => {
  const response = await worker.fetch(
    new Request("https://lovemallacoota.com/category/news/local-update?ref=old"),
    env
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("Location"),
    "https://lovemallacoota.au/?ref=old"
  );
});

test("serves canonical assets with security headers", async () => {
  const response = await worker.fetch(
    new Request("https://lovemallacoota.au/food.html"),
    env
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset:/food.html");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("X-Frame-Options"), "SAMEORIGIN");
});

test("serves the Astro home page asset at the site root", async () => {
  const response = await worker.fetch(
    new Request("https://lovemallacoota.au/?from=home"),
    env
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset:/index.html");
});

test("redirects /index.html to the site root so only one URL serves the home page", async () => {
  const response = await worker.fetch(
    new Request("https://lovemallacoota.au/index.html?ref=old"),
    env
  );
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("Location"), "https://lovemallacoota.au/?ref=old");
});

test("only edition PDF paths are treated as PDF requests", async () => {
  assert.equal(weekFromPath("/edition/2026-w35.pdf"), "2026-w35");
  assert.equal(weekFromPath("/edition/2026-w35.html"), null);
  assert.equal(weekFromPath("/edition/../secrets.pdf"), null);
  assert.equal(weekFromPath("/edition/not-a-week.pdf"), null);
  assert.equal(pdfFilename("2026-w35"), "mallacoota-2026-w35.pdf");
});

test("a PDF for an edition that does not exist is a 404, not a render", async () => {
  const missingAssets = {
    async fetch() {
      return new Response("nope", { status: 404 });
    },
  };
  const response = await worker.fetch(
    new Request("https://lovemallacoota.au/edition/1999-w01.pdf"),
    { ...env, ASSETS: missingAssets, BROWSER: {} },
    { waitUntil() {} }
  );
  assert.equal(response.status, 404);
});

test("the PDF route fails clearly when Browser Rendering is unavailable", async () => {
  const response = await worker.fetch(
    new Request("https://lovemallacoota.au/edition/2026-w35.pdf"),
    { ...env, BROWSER: undefined },
    { waitUntil() {} }
  );
  assert.equal(response.status, 503);
});

test("responses carry the security headers, including a policy that allows what the site loads", async () => {
  const response = await worker.fetch(new Request("https://lovemallacoota.au/food.html"), env, {
    waitUntil() {},
  });
  assert.equal(response.headers.get("Strict-Transport-Security"), "max-age=63072000; includeSubDomains");

  const csp = response.headers.get("Content-Security-Policy");
  assert.ok(csp, "no policy set");
  // The things the site genuinely needs.
  for (const needed of [
    "https://fonts.gstatic.com",
    "https://www.googletagmanager.com",
    "https://ads.oze.net.au",
    "https://challenges.cloudflare.com",
    "https://www.youtube.com",
  ]) {
    assert.ok(csp.includes(needed), `policy blocks ${needed}, which the site loads`);
  }
  // And the things it must not allow.
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.ok(!/script-src[^;]*\*/.test(csp), "the script policy must not be a wildcard");
});
