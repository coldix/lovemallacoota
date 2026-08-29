/*
# Project:     lovemallacoota.au
# File Name:   archive.js
# Description: Filters the Mouth catalogue. The cards and their structured data
#              are rendered by Astro at build time; this only hides and shows
#              what is already in the page, so the archive is readable without
#              JavaScript and visible to crawlers.
*/

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("archive-grid");
  const search = document.getElementById("archive-search");
  const count = document.getElementById("archive-count");
  const years = document.getElementById("archive-years");
  const empty = document.getElementById("archive-empty");
  if (!grid || !search || !count) return;

  const cards = [...grid.querySelectorAll(".archive-card")];
  if (!cards.length) return;
  let activeYear = "All";

  const render = () => {
    const query = search.value.trim().toLocaleLowerCase("en-AU");
    let shown = 0;
    for (const card of cards) {
      const yearOK = activeYear === "All" || card.dataset.year === activeYear;
      const searchOK = !query || (card.dataset.search || "").includes(query);
      const visible = yearOK && searchOK;
      card.hidden = !visible;
      if (visible) shown += 1;
    }
    if (empty) empty.hidden = shown > 0;
    const noun = shown === 1 ? "issue" : "issues";
    count.textContent =
      activeYear === "All" ? `${shown} ${noun} found` : `${shown} ${noun} from ${activeYear}`;
  };

  years?.addEventListener("click", (event) => {
    const button = event.target.closest(".tag-btn");
    if (!button) return;
    activeYear = button.dataset.year;
    for (const other of years.querySelectorAll(".tag-btn")) {
      other.classList.toggle("active", other === button);
    }
    render();
  });

  search.addEventListener("input", render);
  render();
});
