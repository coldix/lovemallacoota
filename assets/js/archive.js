document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("archive-grid");
  const search = document.getElementById("archive-search");
  const count = document.getElementById("archive-count");
  const years = document.getElementById("archive-years");
  if (!grid || !search || !count) return;

  const appendText = (parent, tag, value, className) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.append(element);
    return element;
  };

  const createIssueCard = (issue) => {
    const card = document.createElement("article");
    card.className = "archive-card";

    const headingRow = document.createElement("div");
    headingRow.className = "archive-card-heading";
    appendText(headingRow, "p", issue.publication, "archive-publication");
    appendText(headingRow, "span", `Issue ${issue.issueNumber}`, "archive-issue-number");
    card.append(headingRow);

    appendText(card, "h3", issue.displayDate);
    appendText(card, "p", issue.description, "archive-description");

    const cover = issue.cover && issue.cover.caption ? issue.cover : null;
    if (cover) {
      const coverBlock = document.createElement("p");
      coverBlock.className = "archive-cover";
      const label = document.createElement("strong");
      label.textContent = cover.credit ? `Cover (${cover.credit}): ` : "Cover: ";
      coverBlock.append(label);
      coverBlock.append(document.createTextNode(cover.caption));
      card.append(coverBlock);
    }

    const metadata = document.createElement("dl");
    metadata.className = "archive-metadata";
    for (const [label, value] of [
      ["Pages", issue.pageCount],
      ["Editor", issue.editor || "Not recorded"],
      ["Source", issue.provenance || "Not recorded"],
    ]) {
      appendText(metadata, "dt", label);
      appendText(metadata, "dd", String(value));
    }
    card.append(metadata);

    const contents = Array.isArray(issue.contents) ? issue.contents : [];
    if (contents.length) {
      const toc = document.createElement("details");
      toc.className = "archive-toc";
      const summary = document.createElement("summary");
      summary.textContent = `In this issue (${contents.length})`;
      toc.append(summary);
      const list = document.createElement("ol");
      for (const entry of contents) {
        const item = document.createElement("li");
        const page = document.createElement("span");
        page.className = "archive-toc-page";
        page.textContent = `p${entry.page}`;
        item.append(page);
        item.append(document.createTextNode(entry.title));
        list.append(item);
      }
      toc.append(list);
      card.append(toc);
    }

    const topics = document.createElement("div");
    topics.className = "chips archive-topics";
    for (const topic of issue.topics || []) appendText(topics, "span", topic, "chip");
    card.append(topics);

    const availability = document.createElement("div");
    availability.className = "archive-availability";
    if (issue.pdfUrl) {
      const link = document.createElement("a");
      link.className = "btn btn-primary";
      link.href = issue.pdfUrl;
      link.textContent = "Read issue (PDF)";
      availability.append(link);
    } else {
      appendText(availability, "span", "Catalogued · digital copy under archive review", "archive-status");
    }
    card.append(availability);

    return card;
  };

  try {
    const response = await fetch("/data/archive-index.json");
    if (!response.ok) throw new Error(`Archive index returned ${response.status}`);
    const archive = await response.json();
    const issues = Array.isArray(archive.issues) ? archive.issues : [];

    const yearOf = (issue) => String(issue.publicationDate || "").slice(0, 4);
    let activeYear = "All";

    // Years come from the catalogue, newest first, so the row grows by itself
    // as earlier issues are recovered.
    if (years) {
      const counts = new Map();
      for (const issue of issues) {
        const year = yearOf(issue);
        if (year) counts.set(year, (counts.get(year) || 0) + 1);
      }
      const ordered = [...counts.keys()].sort((a, b) => b.localeCompare(a));
      for (const year of ["All", ...ordered]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = year === "All" ? "tag-btn active" : "tag-btn";
        button.dataset.year = year;
        button.textContent = year === "All" ? "All years" : `${year} (${counts.get(year)})`;
        years.append(button);
      }
      years.addEventListener("click", (event) => {
        const button = event.target.closest(".tag-btn");
        if (!button) return;
        activeYear = button.dataset.year;
        for (const other of years.querySelectorAll(".tag-btn")) {
          other.classList.toggle("active", other === button);
        }
        render();
      });
    }

    const render = () => {
      const query = search.value.trim().toLocaleLowerCase("en-AU");
      const filtered = issues.filter((issue) => {
        if (activeYear !== "All" && yearOf(issue) !== activeYear) return false;
        const searchable = [
          issue.publication,
          issue.issueNumber,
          issue.displayDate,
          issue.publicationDate,
          issue.editor,
          issue.description,
          issue.provenance,
          issue.cover?.caption,
          issue.cover?.credit,
          ...(issue.topics || []),
          ...(issue.keywords || []),
          ...(issue.contents || []).map((entry) => `${entry.page} ${entry.title}`),
        ].join(" ").toLocaleLowerCase("en-AU");
        return searchable.includes(query);
      });

      grid.replaceChildren(...filtered.map(createIssueCard));
      const noun = filtered.length === 1 ? "issue" : "issues";
      count.textContent =
        activeYear === "All"
          ? `${filtered.length} ${noun} found`
          : `${filtered.length} ${noun} from ${activeYear}`;
      if (!filtered.length) {
        appendText(grid, "p", "No archived issues match that search.", "no-results");
      }
    };

    search.addEventListener("input", render);
    render();
  } catch (error) {
    console.error(error);
    count.textContent = "Archive temporarily unavailable";
    appendText(grid, "p", "The archive catalogue could not be loaded. Please try again later.", "no-results");
  }
});
