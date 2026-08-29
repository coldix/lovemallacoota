import assert from "node:assert/strict";
import test from "node:test";

import { escapeHTML, renderBlock, renderBody, safeHref } from "../src/lib/markup.mjs";

test("everything is escaped before anything is interpreted", () => {
  assert.equal(
    renderBlock('<script>alert("x")</script>'),
    "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>"
  );
  assert.equal(
    renderBlock('<img src=x onerror="steal()">'),
    "<p>&lt;img src=x onerror=&quot;steal()&quot;&gt;</p>"
  );
  assert.ok(!renderBlock("<b>not bold</b>").includes("<b>"));
});

test("bold, italic and underscores", () => {
  assert.equal(renderBlock("A **firm** point."), "<p>A <strong>firm</strong> point.</p>");
  assert.equal(renderBlock("A *soft* point."), "<p>A <em>soft</em> point.</p>");
  assert.equal(renderBlock("An _aside_ here."), "<p>An <em>aside</em> here.</p>");
  // Bold must win over italic on the same run of asterisks.
  assert.equal(renderBlock("**both**"), "<p><strong>both</strong></p>");
  // A lone asterisk is not markup.
  assert.equal(renderBlock("2 * 3 = 6"), "<p>2 * 3 = 6</p>");
});

test("links are allowed only where they can safely point", () => {
  assert.equal(safeHref("https://example.com/x"), "https://example.com/x");
  assert.equal(safeHref("mailto:someone@example.com"), "mailto:someone@example.com");
  assert.equal(safeHref("/archive.html"), "/archive.html");
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("data:text/html;base64,PHNjcmlwdD4="), null);
  assert.equal(safeHref("//evil.example.com"), null);
});

test("a link renders, and a dangerous one stays as text", () => {
  const external = renderBlock("See [the archive](https://lovemallacoota.au/archive.html).");
  assert.match(external, /<a href="https:\/\/lovemallacoota\.au\/archive\.html" target="_blank" rel="noopener noreferrer">the archive<\/a>/);

  const internal = renderBlock("See [the archive](/archive.html).");
  assert.match(internal, /<a href="\/archive\.html">the archive<\/a>/);
  assert.ok(!internal.includes("target="), "internal links do not open a new tab");

  const dangerous = renderBlock("[click me](javascript:alert(1))");
  assert.ok(!dangerous.includes("<a "), "a javascript: URL must not become a link");
  assert.ok(dangerous.includes("[click me]"), "it stays as the text they typed");
});

test("bullet lists", () => {
  assert.equal(
    renderBlock("- Bread\n- Milk\n- Bait"),
    '<ul class="edition-list"><li>Bread</li><li>Milk</li><li>Bait</li></ul>'
  );
  // A dash mid-sentence is not a list.
  assert.match(renderBlock("Meet at the wharf - bring a hat"), /^<p>/);
});

test("markup inside a list item still works, and still escapes", () => {
  const html = renderBlock("- **Tuesday** at the hall\n- <b>raw</b> stays text");
  assert.ok(html.includes("<strong>Tuesday</strong>"));
  assert.ok(html.includes("&lt;b&gt;raw&lt;/b&gt;"));
});

test("a body is a run of blocks", () => {
  const html = renderBody(["First.", "- one\n- two", "Last with a **word**."]);
  assert.equal(
    html,
    '<p>First.</p><ul class="edition-list"><li>one</li><li>two</li></ul><p>Last with a <strong>word</strong>.</p>'
  );
});

test("escapeHTML covers the characters that matter", () => {
  assert.equal(escapeHTML(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});
