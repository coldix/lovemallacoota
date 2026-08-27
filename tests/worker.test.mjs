import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.ts";

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
