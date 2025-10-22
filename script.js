/*
# Project:     lovemallacoota.com.au
# Author:      Colin Dixon BSc, DipEd, Cert IV TAE
# Contact:     crdixon@gmail.com
# Timestamp:   23/10/2025 12:18 PM AEDT (Mallacoota)
# Version:     [25.10.013]
# File Name:   script.js
# Description: Handles theming, backgrounds, and dynamic content rendering with JSON field mapping for descriptions and links[].
*/

document.addEventListener("DOMContentLoaded", () => {
  // --- Version Info ---
  const FILE_VERSION = "25.10.013";
  const FILE_DATE = "23 Oct 2025";

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
      themeLabel && (themeLabel.textContent = "Dark");
      themeIcon && (themeIcon.innerHTML = icons.moon);
      themeToggleButton?.setAttribute("aria-pressed", "true");
    } else {
      themeLabel && (themeLabel.textContent = "Light");
      themeIcon && (themeIcon.innerHTML = icons.sun);
      themeToggleButton?.setAttribute("aria-pressed", "false");
    }
  };

  themeToggleButton?.addEventListener("click", () => {
    const newTheme =
      htmlElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(newTheme);
  });

  const initialTheme =
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");
  applyTheme(initialTheme);

  // --- Background Image ---
  (function setRandomBackground() {
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
  })();

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

  // Helpers to align with your JSON structure
  const getPrimaryLink = (business) => {
    // Prefer a link with text "Website", else first link
    if (Array.isArray(business.links) && business.links.length) {
      const site =
        business.links.find(
          (l) => (l.text || "").toLowerCase() === "website"
        ) || business.links[0];
      return site?.url;
    }
    // Fallback to first social if no links[]
    if (Array.isArray(business.social_links) && business.social_links.length) {
      return business.social_links[0].url;
    }
    return null;
  };

  const getDescription = (business) =>
    business.description_short || business.description_long || "";

  const formatAddress = (addr) => {
    if (!addr) return "";
    return [addr.street, addr.locality, addr.state, addr.postcode]
      .filter(Boolean)
      .join(", ");
  };

  function buildLinksHTML(business) {
    const links = [];

    // Primary presence
    const primary = getPrimaryLink(business);
    if (primary) {
      // Use the text from the JSON if present
      const label =
        (Array.isArray(business.links) &&
          business.links.find((l) => l.url === primary)?.text) ||
        "Website";
      links.push(
        `<a href="${primary}" target="_blank" rel="noopener noreferrer">${label}</a>`
      );
    } else {
      const safeName = (business.business_name || "Business").replace(
        /"/g,
        "&quot;"
      );
      links.push(
        `<button type="button" class="suggest-link" data-bname="${safeName}">Suggest Link</button>`
      );
    }

    // Map + Directions
    if (business.geo?.latitude && business.geo?.longitude) {
      const lat = business.geo.latitude;
      const lng = business.geo.longitude;
      links.push(
        `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer">Map</a>`
      );
      links.push(
        `<a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener noreferrer">Directions</a>`
      );
    } else if (business.address) {
      const q = encodeURIComponent(formatAddress(business.address));
      links.push(
        `<a href="https://www.google.com/maps?q=${q}" target="_blank" rel="noopener noreferrer">Map</a>`
      );
    }

    // Call
    if (business.phone) {
      const tel = String(business.phone).replace(/\s+/g, "");
      links.push(`<a href="tel:${tel}">Call</a>`);
    }

    // Email
    if (business.email) {
      links.push(`<a href="mailto:${business.email}">Email</a>`);
    }

    return `<div class="links">${links.join("")}</div>`;
  }

  const createListingCard = (business) => {
    const card = document.createElement("div");
    card.className = "listing-card";

    const addressText = formatAddress(business.address);
    const tags =
      Array.isArray(business.category_tags) && business.category_tags.length
        ? `<div class="chips">${business.category_tags
            .map((t) => `<span class="chip">${t}</span>`)
            .join("")}</div>`
        : "";

    const desc = getDescription(business) || "No description available.";
    const linksHTML = buildLinksHTML(business);

    card.innerHTML = `
      <h3>${business.business_name || "Unnamed Business"}</h3>
      ${tags}
      <p>${desc}</p>
      ${
        addressText
          ? `<p style="opacity:.8;font-size:.85rem;">${addressText}</p>`
          : ""
      }
      ${linksHTML}
    `;
    return card;
  };

  const renderListings = async () => {
    const category = getCategoryForPage();
    if (!category || !listingsGrid) return;

    try {
      const response = await fetch("data/coota.json");
      if (!response.ok) throw new Error("Network response not ok.");
      const allBusinesses = await response.json();

      const pageCategories = (
        Array.isArray(category) ? category : [category]
      ).map((c) => c.toLowerCase().trim());

      const filtered = allBusinesses.filter((biz) => {
        const tags = (biz.category_tags || []).map((t) =>
          String(t).toLowerCase().trim()
        );
        return tags.some((t) => pageCategories.includes(t));
      });

      listingsGrid.innerHTML = "";
      if (!filtered.length) {
        listingsGrid.innerHTML = "<p>No listings found for this category.</p>";
        return;
      }

      filtered.forEach((biz) =>
        listingsGrid.appendChild(createListingCard(biz))
      );
    } catch (err) {
      console.error("Error loading listings:", err);
      listingsGrid.innerHTML =
        "<p>Sorry, there was an error loading the listings.</p>";
    }
  };

  renderListings();

  // Suggest Link handler
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

  // Footer version info (if present)
  (function setFooterInfo() {
    const yearEl = document.getElementById("copyright-year");
    const versionEl = document.getElementById("footer-version-info");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    if (versionEl) versionEl.textContent = `V: ${FILE_VERSION} • ${FILE_DATE}`;
  })();
});
