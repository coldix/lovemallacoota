/*
# Project:     lovemallacoota.com.au
# Author:      Colin Dixon BSc, DipEd, Cert IV TAE
# Contact:     crdixon@gmail.com
# Timestamp:   21/10/2025 08:29 PM AEDT (Mallacoota)
# Version:     [25.10.011]
# File Name:   script.js
# Description: Handles theming, backgrounds, and dynamic content rendering.
*/

document.addEventListener("DOMContentLoaded", () => {
  // --- Version Info ---
  const FILE_VERSION = "25.10.011";
  const FILE_DATE = "21 Oct 2025";

  // --- Theme Toggler ---
  const themeToggleButton = document.getElementById("theme-toggle");
  const themeLabel = document.getElementById("theme-label");
  const themeIcon = document.getElementById("theme-icon");
  const htmlElement = document.documentElement;

  const icons = {
    moon: '<svg viewBox="0 0 24 24"><path d="M11.2 2.01c.14-.04.28-.06.42-.06 2.06 0 3.92.83 5.28 2.19.14.13.26.28.37.43.49.68.86 1.45 1.1 2.28.24.83.33 1.7.28 2.56-.05.86-.25 1.71-.58 2.5-.33.79-.8 1.51-1.39 2.14-.59.63-1.3 1.16-2.11 1.56-.81.4-1.7.67-2.63.79-1.57.19-3.13-.15-4.47-.92-1.33-.77-2.42-2-3.1-3.46-.68-1.46-.94-3.08-.75-4.65.19-1.58.85-3.07 1.88-4.29C8.38 3.01 9.72 2.2 11.2 2.01m0-2.01C4.9 0 0 4.9 0 11.2s4.9 11.2 11.2 11.2c5.29 0 9.7-3.71 10.96-8.62.06-.23.1-.46.15-.69-.02.16-.04.32-.06.49-.49 4.34-4.14 7.7-8.59 7.7-4.97 0-9-4.03-9-9s4.03-9 9-9c.34 0 .67.02.99.06C11.53.02 11.37 0 11.2 0z"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><path d="M12 5c.55 0 1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1v2c0 .55.45 1 1 1zm7.78-.22c.39-.39 1.02-.39 1.41 0l1.41 1.41c.39.39.39 1.02 0 1.41-.39.39-1.02-.39-1.41 0l-1.41-1.41c-.39-.39-.39-1.02 0-1.41zm-1.41 15.18c.39.39.39 1.02 0 1.41l-1.41 1.41c-.39.39-1.02-.39-1.41 0-.39-.39-.39-1.02 0-1.41l1.41-1.41c.39-.39 1.03-.39 1.41 0zM12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM19 12c0-.55.45-1 1-1h2c.55 0 1 .45 1 1s-.45 1-1 1h-2c-.55 0-1-.45-1-1zM3 12c0-.55.45-1 1-1h2c.55 0 1 .45 1 1s-.45 1-1 1H4c-.55 0-1-.45-1-1zm2.22 6.78c-.39.39-1.02-.39-1.41 0-.39-.39-.39-1.02 0-1.41l1.41-1.41c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41l-1.41 1.41zM12 19c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1z"/></svg>',
  };

  const applyTheme = (theme) => {
    htmlElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      if (themeLabel) themeLabel.textContent = "Dark";
      if (themeIcon) themeIcon.innerHTML = icons.moon;
      if (themeToggleButton)
        themeToggleButton.setAttribute("aria-pressed", "true");
    } else {
      if (themeLabel) themeLabel.textContent = "Light";
      if (themeIcon) themeIcon.innerHTML = icons.sun;
      if (themeToggleButton)
        themeToggleButton.setAttribute("aria-pressed", "false");
    }
  };

  if (themeToggleButton) {
    themeToggleButton.addEventListener("click", () => {
      const newTheme =
        htmlElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(newTheme);
    });
  }

  const initialTheme =
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");
  applyTheme(initialTheme);

  // --- Background Image ---
  const setRandomBackground = () => {
    const backgrounds = [
      "images/background-01.webp",
      "images/background-02.webp",
      "images/background-03.webp",
      "images/background-04.webp",
      "images/background-05.webp",
      "images/background-06.webp",
    ];
    const randomImage =
      backgrounds[Math.floor(Math.random() * backgrounds.length)];
    document.body.style.backgroundImage = `url('${randomImage}')`;
  };
  setRandomBackground();

  // --- Dynamic Content Loading ---
  const listingsGrid = document.getElementById("listings-grid");

  const getCategoryForPage = () => {
    const path = window.location.pathname.split("/").pop();
    switch (path) {
      case "food.html":
        return "Food & Drink";
      case "accom.html":
        return "Accommodation";
      case "activity.html":
        return ["Tours & Activities", "Shopping"];
      default:
        return null;
    }
  };

  // --- helpers for link buttons ---
  function buildLinksHTML(business) {
    const links = [];

    // Primary presence button (Website, Instagram, Facebook, etc.)
    if (business.website) {
      // Use the link_text from the JSON, or fallback to 'Website' if it's missing
      const label = business.link_text || "Website";
      links.push(
        `<a href="${business.website}" target="_blank" rel="noopener noreferrer">${label}</a>`
      );
    } else {
      // If no presence link at all, provide the “Let me know link” button
      const safeName = (business.business_name || "Business").replace(
        /"/g,
        "&quot;"
      );
      links.push(
        `<button type="button" class="suggest-link" data-bname="${safeName}">Suggest Link</button>`
      );
    }

    // Call button if phone exists
    if (business.phone) {
      const tel = String(business.phone).replace(/\s+/g, "");
      links.push(`<a href="tel:${tel}">Call</a>`);
    }

    return `<div class="links">${links.join("")}</div>`;
  }

  const createListingCard = (business) => {
    const card = document.createElement("div");
    card.className = "listing-card";

    const linksHTML = buildLinksHTML(business);

    card.innerHTML = `
      <h3>${business.business_name}</h3>
      <p>${business.description || "No description available."}</p>
      ${linksHTML}
    `;
    return card;
  };

  const renderListings = async () => {
    const category = getCategoryForPage();
    if (!category || !listingsGrid) return;

    try {
      const response = await fetch("data/coota.json");
      if (!response.ok) {
        throw new Error("Network response was not ok.");
      }
      const allBusinesses = await response.json();

      const filteredBusinesses = allBusinesses.filter((business) => {
        const pageCategories = (
          Array.isArray(category) ? category : [category]
        ).map((c) => c.toLowerCase().trim());
        const tags = (business.category_tags || []).map((t) =>
          String(t).toLowerCase().trim()
        );
        return tags.some((t) => pageCategories.includes(t));
      });

      if (filteredBusinesses.length === 0) {
        listingsGrid.innerHTML = "<p>No listings found for this category.</p>";
        return;
      }

      listingsGrid.innerHTML = "";
      filteredBusinesses.forEach((business) => {
        const card = createListingCard(business);
        listingsGrid.appendChild(card);
      });
    } catch (error) {
      console.error("Error fetching or parsing listings:", error);
      listingsGrid.innerHTML =
        "<p>Sorry, there was an error loading the listings.</p>";
    }
  };

  renderListings();

  // Handle "Let me know link" prompt -> email
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".suggest-link");
    if (!btn) return;

    const bname = btn.getAttribute("data-bname") || "Business";
    const userLink = prompt(`Paste the correct link for "${bname}":`);
    if (!userLink) return;

    const subject = encodeURIComponent(`Directory link for ${bname}`);
    const body = encodeURIComponent(
      `Suggested URL: ${userLink}\n\n(Submitted from ${location.href})`
    );
    window.location.href = `mailto:crdixon@gmail.com?subject=${subject}&body=${body}`;
  });

  // --- Footer Info ---
  const setFooterInfo = () => {
    const yearEl = document.getElementById("copyright-year");
    const versionEl = document.getElementById("footer-version-info");
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
    if (versionEl) {
      versionEl.textContent = `V: ${FILE_VERSION} • ${FILE_DATE}`;
    }
  };
  setFooterInfo();
});
