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
    "https://calendar.google.com",
  ]) {
    assert.ok(csp.includes(needed), `policy blocks ${needed}, which the site loads`);
  }
  // And the things it must not allow.
  assert.match(csp, /object-src 'self'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.ok(!/script-src[^;]*\*/.test(csp), "the script policy must not be a wildcard");
});

test("the short payment paths hand off to Stripe, and say so when unconfigured", async () => {
  const configured = {
    ...env,
    STRIPE_LINK_DONATE: "https://buy.stripe.com/test_donate",
    STRIPE_LINK_SUBSCRIBE: "https://buy.stripe.com/test_subscribe",
    STRIPE_LINK_ADVERTISE: "https://buy.stripe.com/test_advertise",
  };

  for (const [path, expected] of [
    ["/donate", "https://buy.stripe.com/test_donate"],
    ["/subscribe", "https://buy.stripe.com/test_subscribe"],
    ["/advertise", "https://buy.stripe.com/test_advertise"],
  ]) {
    const response = await worker.fetch(
      new Request(`https://lovemallacoota.au${path}`),
      configured,
      { waitUntil() {} }
    );
    assert.equal(response.status, 302, `${path} should redirect`);
    assert.equal(response.headers.get("Location"), expected);
  }

  // A missing link must not send anyone to a broken page.
  const unset = await worker.fetch(
    new Request("https://lovemallacoota.au/donate"),
    { ...env, STRIPE_LINK_DONATE: undefined },
    { waitUntil() {} }
  );
  assert.equal(unset.status, 503);
});

test("the retired Local of the Week page redirects to the archive that replaced it", async () => {
  for (const path of ["/locals.html", "/locals", "/locals/"]) {
    const response = await worker.fetch(
      new Request(`https://lovemallacoota.au${path}`),
      env
    );
    assert.equal(response.status, 301, `${path} did not redirect`);
    // No fragment on the Location, so a shared /locals.html#article-… keeps its
    // own and lands on the matching row in the archive index.
    assert.equal(
      response.headers.get("Location"),
      "https://lovemallacoota.au/archive.html"
    );
  }
});

test("a listing that changed its name keeps its old address working", async () => {
  const response = await worker.fetch(
    new Request("https://lovemallacoota.au/listing/bribes-gift-shop-and-fresh-flowers.html"),
    env
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("Location"),
    "https://lovemallacoota.au/listing/sues-bribes.html"
  );
});

test("a preview hostname is told not to index the production pages it serves", async () => {
  const preview = await worker.fetch(
    new Request("https://lovemallacoota-preview.workers.dev/edition.html"),
    env
  );
  assert.equal(preview.headers.get("X-Robots-Tag"), "noindex, nofollow");

  const production = await worker.fetch(
    new Request("https://lovemallacoota.au/edition.html"),
    env
  );
  assert.equal(production.headers.get("X-Robots-Tag"), null);
});

test("every third party the site loads is allowed in the directive it needs", async () => {
  const response = await worker.fetch(new Request("https://lovemallacoota.au/"), env);
  const csp = response.headers.get("Content-Security-Policy");
  const directive = (name) =>
    csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) || "";

  // Turnstile needs all three. It was in script-src and frame-src but not
  // connect-src, so the script loaded, built its container, and then died on
  // the call that starts the challenge — no iframe, no token, no error. Every
  // form on the site failed from launch until this was found.
  for (const name of ["script-src", "connect-src", "frame-src"]) {
    assert.ok(
      directive(name).includes("https://challenges.cloudflare.com"),
      `Turnstile is missing from ${name}; the widget will fail silently`
    );
  }

  // The embeds, each in the directive that actually governs it.
  assert.ok(directive("frame-src").includes("https://www.youtube-nocookie.com"), "the video embed is blocked");
  assert.ok(directive("frame-src").includes("https://calendar.google.com"), "What's On is blocked");
  assert.ok(directive("frame-src").includes("https://kuula.co"), "the 360 view is blocked");
  assert.ok(directive("font-src").includes("https://fonts.gstatic.com"), "the typefaces are blocked");
  assert.ok(directive("style-src").includes("https://fonts.googleapis.com"), "the font stylesheet is blocked");

  // The relay is called from the Worker, not the page, so it needs no entry —
  // but the ad tag is fetched by the browser and does.
  assert.ok(directive("connect-src").includes("https://ads.oze.net.au"), "the ad tag cannot report");
});
