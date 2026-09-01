/*
# Project:     lovemallacoota.au
# File Name:   markup.mjs
# Description: A deliberately small markup subset for contributed text: bold,
#              italic, links and bullet lists. Everything else is escaped.
#
#              The order matters. Every character is escaped first, and only
#              then are the four patterns turned into tags, so a contributor
#              cannot introduce markup of their own — a pasted <script>, an
#              onclick attribute, or a javascript: URL all end up as visible
#              text rather than behaviour.
*/

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

/**
 * Links may point at the web, at an email address, or within this site.
 * Anything else — javascript:, data:, vbscript:, a bare protocol-relative
 * host — is not a link and is left as text.
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

  // [text](href) — the href is validated, and the text keeps its own markup.
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
 * One stored paragraph becomes one block of HTML: a bullet list when every
 * line is a bullet, otherwise a paragraph with its line breaks folded away.
 */
export function renderBlock(text, isPoem = false) {
  const lines = String(text).split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "";

  const bullets = lines.every((line) => /^[-*]\s+\S/.test(line));
  if (bullets) {
    const items = lines
      .map((line) => `<li>${inline(escapeHTML(line.replace(/^[-*]\s+/, "")))}</li>`)
      .join("");
    return `<ul class="edition-list">${items}</ul>`;
  }

  if (isPoem) {
    const poemLines = lines.map((line) => inline(escapeHTML(line))).join("<br />");
    return `<div class="poem-stanza" style="margin-bottom: 1.25rem; font-style: italic; line-height: 1.6; break-inside: avoid-column;">${poemLines}</div>`;
  }

  return `<p>${inline(escapeHTML(lines.join(" ")))}</p>`;
}

/** The whole body, as a single string of HTML blocks. */
export function renderBody(paragraphs, isPoem = false) {
  return (paragraphs || []).map((paragraph) => renderBlock(paragraph, isPoem)).filter(Boolean).join("");
}
