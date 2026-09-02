import assert from "node:assert/strict";
import test from "node:test";

import { escapeHTML, plainPunctuation, renderBlock, renderBody, safeHref } from "../src/lib/markup.mjs";

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

test("a line break the contributor typed is kept", () => {
  // A poem was folded into prose because single newlines were joined with a space.
  assert.equal(renderBlock("Line one\nLine two"), "<p>Line one<br />Line two</p>");
  assert.equal(renderBlock("Line one\nLine two", true), '<div class="poem-stanza" style="margin-bottom: 1.5rem; font-style: italic; font-size: 1.05rem; line-height: 1.75; letter-spacing: 0.01em;">Line one<br />Line two</div>');
});

test("a line of its own beginning ## is a subheading", () => {
  assert.equal(renderBlock("## Farewell to Barbara"), '<h4 class="edition-subhead">Farewell to Barbara</h4>');
  assert.match(renderBlock("## not a heading\nsecond line"), /^<p>/);
  assert.match(renderBlock("#hashtag"), /^<p>/);
});

test("typographic punctuation is published plain", () => {
  assert.equal(
    plainPunctuation("Frank\u2019s \u201cbig\u201d day \u2014 then 29 \u2013 and more\u2026"),
    'Frank\'s "big" day - then 29 - and more...'
  );
  assert.equal(plainPunctuation("Tuppy\u2014remembered"), "Tuppy - remembered");
  // Mojibake from a bad round trip is repaired rather than flattened.
  assert.equal(plainPunctuation("Frank\u00e2\u20ac\u2122s day \u00e2\u20ac\u201d 360\u00c2\u00b0"), "Frank's day - 360\u00b0");
  // And the shape left by the earlier repair that only got half way.
  assert.equal(plainPunctuation("Frank\u2014\u0080\u0099s \u2014\u0080\u009cBuffalo\u2014\u0080\u009d"), 'Frank\'s "Buffalo"');
  assert.equal(plainPunctuation("plain text stays"), "plain text stays");
});
