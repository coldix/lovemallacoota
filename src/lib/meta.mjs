/*
# Project:     lovemallacoota.au
# File Name:   meta.mjs
# Description: One place to keep a meta description the length a search result
#              will actually show. Descriptions built from live data — this
#              week's sections, an edition's headlines — vary in length week to
#              week, and a description cut off mid-word by Google reads worse
#              than one that ended on its own terms.
*/

/** Google shows roughly 155 to 160 characters. Cut on a boundary, not a letter. */
export function clampMeta(text, limit = 158) {
  const value = String(text).replace(/\s+/g, " ").trim();
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit - 1);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  if (stop > limit * 0.6) return cut.slice(0, stop + 1).trim();
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\-–—]$/, "").trim()}...`;
}
