/*
# Project:     lovemallacoota.au
# File Name:   markup.mjs
# Description: A deliberately small markup subset for contributed text: bold,
#              italic, links, bullet lists and a subheading. Everything else is
#              escaped.
#
#              The order matters. Every character is escaped first, and only
#              then are the patterns turned into tags, so a contributor cannot
#              introduce markup of their own: a pasted <script>, an onclick
#              attribute, or a javascript: URL all end up as visible text
#              rather than behaviour.
*/

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

/**
 * Text pasted from Word or a phone arrives with curly quotes, em dashes and
 * ellipses, and twice now those have reached the page as mojibake after a bad
 * encoding round trip. The edition is published in plain punctuation instead:
 * straight quotes, a spaced hyphen where a dash was, three dots for an
 * ellipsis. The first group repairs text that has already been through such a
 * round trip; the rest flattens what is still intact. Written with escapes so
 * this file never carries the characters it removes.
 */
const REPAIRS = [
  // UTF-8 read as Latin-1: a-circumflex, euro sign, trade mark is a right single quote, and so on.
  [/\u00e2\u20ac\u2122|\u00e2\u20ac\u02dc/g, "'"],
  [/\u00e2\u20ac\u0153|\u00e2\u20ac\u009d/g, '"'],
  [/\u00e2\u20ac[\u201d\u201c]/g, " - "],
  [/\u00e2\u20ac\u00a6/g, "..."],
  [/\u00c2\u00b0/g, "\u00b0"],
  [/\u00c2[ \u00a0]/g, " "],
  // A previous repair that swapped the first byte for a dash and left the rest.
  [/\u2014\u0080\u0099/g, "'"],
  [/\u2014\u0080[\u009c\u009d]/g, '"'],
  [/\u2014\u0080\u0094/g, " - "],
];

export function plainPunctuation(value) {
  let text = String(value ?? "");
  for (const [pattern, replacement] of REPAIRS) text = text.replace(pattern, replacement);
  return text
    .replace(/[\u2018\u2019\u201a\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0080-\u009f]/g, "")
    .replace(/[ \t]*\u2014[ \t]*/g, " - ")
    .replace(/\u2013/g, "-")
    .replace(/ {2,}/g, " ");
}

/**
 * Links may point at the web, at an email address, or within this site.
 * Anything else (javascript:, data:, vbscript:, a bare protocol-relative
 * host) is not a link and is left as text.
 */
export function safeHref(href) {
  const trimmed = href.trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(trimmed)) return trimmed;
  if (/^mailto:[^\s"'<>]+@[^\s"'<>]+$/i.test(trimmed)) return trimmed;
  if (/^\/[^\s"'<>]*$/.test(trimmed) && !trimmed.startsWith("//")) return trimmed;
  return null;
}

/** Bold, italic and links, applied to text that is already escaped. */
function inline(escaped) {
  let html = escaped;

  // [text](href): the href is validated, and the text keeps its own markup.
  html = html.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (whole, text, href) => {
    const safe = safeHref(href.replace(/&amp;/g, "&"));
    if (!safe) return whole;
    const external = /^https?:/i.test(safe);
    const attributes = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHTML(safe)}"${attributes}>${text}</a>`;
  });

  // **bold** before *italic*, or the italic rule eats the first two asterisks.
  html = html.replace(/\*\*(?=\S)([^*\n]+?)(?<=\S)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[\s(])\*(?=\S)([^*\n]+?)(?<=\S)\*/g, "$1<em>$2</em>");
  html = html.replace(/(^|[\s(])_(?=\S)([^_\n]+?)(?<=\S)_/g, "$1<em>$2</em>");

  return html;
}

/**
 * One stored paragraph becomes one block of HTML: a subheading when it is a
 * single line beginning "##", a bullet list when every line is a bullet,
 * otherwise a paragraph. A line break the contributor typed is kept, so a
 * verse or an address stays as it was set out; it used to be folded away,
 * which ran a poem together into prose.
 */
export function renderBlock(text, isPoem = false) {
  const lines = String(text).split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "";

  if (lines.length === 1 && /^#{1,6}\s+\S/.test(lines[0])) {
    return `<h4 class="edition-subhead">${inline(escapeHTML(lines[0].replace(/^#{1,6}\s+/, "")))}</h4>`;
  }

  const bullets = lines.every((line) => /^[-*]\s+\S/.test(line));
  if (bullets) {
    const items = lines
      .map((line) => `<li>${inline(escapeHTML(line.replace(/^[-*]\s+/, "")))}</li>`)
      .join("");
    return `<ul class="edition-list">${items}</ul>`;
  }

  const rendered = lines.map((line) => inline(escapeHTML(line))).join("<br />");
  if (isPoem) {
    return `<div class="poem-stanza" style="margin-bottom: 1.5rem; font-style: italic; font-size: 1.05rem; line-height: 1.75; letter-spacing: 0.01em;">${rendered}</div>`;
  }
  return `<p>${rendered}</p>`;
}

/** The whole body, as a single string of HTML blocks. */
export function renderBody(paragraphs, isPoem = false) {
  return (paragraphs || []).map((paragraph) => renderBlock(paragraph, isPoem)).filter(Boolean).join("");
}
