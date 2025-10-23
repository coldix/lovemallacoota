/*
# Project:     lovemallacoota.com.au
# Author:      Colin Dixon BSc, DipEd, Cert IV TAE
# Contact:     crdixon@gmail.com
# Assistant:   Gemini
# Timestamp:   23/10/2025 01:58 PM AEDT (Mallacoota)
# Version:     [25.10.017]
# File Name:   script.js
# Description: Handles theming, backgrounds, dynamic content rendering from
#              split JSON files, and LocalBusiness schema injection.
*/

document.addEventListener("DOMContentLoaded", () => {
  // --- Version Info ---
  const FILE_VERSION = "25.10.017";
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

  // --- Page Setup & Content Loading ---
  const path = window.location.pathname.split("/").pop();

  // 1. Inject Schema for Home Page
  if (path === "" || path === "index.html") {
    injectWebSiteSchema();
  }

  // 2. Load Listings for Category Pages
  renderListings();

  // --- Card Building Helpers ---
  // (These are unchanged, they work with the new JSON)
  const getPrimaryLink = (business) => {
    if (Array.isArray(business.links) && business.links.length) {
      const site =
        business.links.find(
          (l) => (l.text || "").toLowerCase() === "website"
        ) || business.links[0];
      return site?.url;
    }
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
    const primary = getPrimaryLink(business);
    if (primary) {
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
        '""'
      );
      links.push(
        `<button type="button" class="suggest-link" data-bname="${safeName}">Suggest Link</button>`
      );
    }

    if (business.geo?.latitude && business.geo?.longitude) {
      const lat = business.geo.latitude;
      const lng = business.geo.longitude;
      links.push(
        `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener noreferrer">Map</a>`
      );
      links.push(
        `<a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener noreferrer">Directions</a>`
      );
    } else if (business.address) {
      const q = encodeURIComponent(formatAddress(business.address));
      links.push(
        `<a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener noreferrer">Map</a>`
      );
    }

    if (business.phone) {
      const tel = String(business.phone).replace(/\s+/g, "");
      links.push(`<a href="tel:${tel}">Call</a>`);
    }

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

  // --- NEW: Dynamic Listing & Schema Renderer ---

  /**
   * Determines which JSON files and metadata to use for the current page.
   */
  function getListingDataForPage() {
    const path = window.location.pathname.split("/").pop();
    switch (path) {
      case "food.html":
        return {
          filesToFetch: ["data/listings_food.json"],
          pageTitle: "Eat & Drink in Mallacoota",
          pageUrl: "https://lovemallacoota.com.au/food.html",
        };
      case "accom.html":
        return {
          filesToFetch: ["data/listings_accom.json"],
          pageTitle: "Stay in Mallacoota",
          pageUrl: "https.lovemallacoota.com.au/accom.html",
        };
      case "activity.html":
        return {
          filesToFetch: ["data/listings_do.json", "data/listings_other.json"],
          pageTitle: "Do & See in Mallacoota",
          pageUrl: "https.lovemallacoota.com.au/activity.html",
        };
      default:
        // Not a listing page
        return { filesToFetch: [], pageTitle: "", pageUrl: "" };
    }
  }

  /**
   * Fetches data from the correct JSON files and renders the cards.
   */
  async function renderListings() {
    const listingsGrid = document.getElementById("listings-grid");
    if (!listingsGrid) return; // Not a listing page, do nothing.

    const { filesToFetch, pageTitle, pageUrl } = getListingDataForPage();
    if (filesToFetch.length === 0) return;

    try {
      // Fetch all required files in parallel
      const allResponses = await Promise.all(
        filesToFetch.map((url) => fetch(url))
      );

      // Check all responses are ok
      for (const response of allResponses) {
        if (!response.ok) {
          // If listings_other.json returns 404, we don't want to fail
          // We'll treat it as an empty list instead
          if (response.status === 404) {
            console.warn(`File not found (this may be ok): ${response.url}`);
            continue; // Go to the next response
          }
          throw new Error(`Network response not ok for ${response.url}`);
        }
      }

      // Get JSON data, handling 404s as empty arrays
      const allListings = await Promise.all(
        allResponses.map(
          (res) => (res.ok ? res.json() : Promise.resolve([])) // Return empty array on error
        )
      );

      // Combine all results into one array and sort alphabetically
      let allBusinesses = allListings
        .flat()
        .sort((a, b) =>
          (a.business_name || "").localeCompare(b.business_name || "")
        );

      // --- 🚀 SEO: Inject LocalBusiness Schema ---
      if (allBusinesses.length > 0) {
        injectCategorySchema(allBusinesses, pageTitle, pageUrl);
      }

      // --- 🎨 Render Cards ---
      listingsGrid.innerHTML = "";
      if (allBusinesses.length === 0) {
        listingsGrid.innerHTML = "<p>No listings found for this category.</p>";
        return;
      }

      allBusinesses.forEach((biz) =>
        listingsGrid.appendChild(createListingCard(biz))
      );
    } catch (err) {
      console.error("Error loading listings:", err);
      listingsGrid.innerHTML =
        "<p>Sorry, there was an error loading the listings.</p>";
    }
  }

  // --- Event Listeners (Unchanged) ---
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

  (function setFooterInfo() {
    const yearEl = document.getElementById("copyright-year");
    const versionEl = document.getElementById("footer-version-info");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    if (versionEl) versionEl.textContent = `V: ${FILE_VERSION} • ${FILE_DATE}`;
  })();

  // --- 🚀 NEW: Schema.org JSON-LD Injection Functions ---

  /**
   * Helper function to create and append a JSON-LD script tag to the head.
   * @param {object} schema - The JSON-LD schema object.
   */
  function appendSchema(schema) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema); // Minified for production
    document.head.appendChild(script);
  }

  /**
   * Injects WebSite schema into the document head.
   * This is for the home page (index.html).
   */
  function injectWebSiteSchema() {
    const schema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      url: "https://lovemallacoota.com.au/",
      name: "Love Mallacoota",
      description:
        "Your local guide to Mallacoota — places to eat, stay, and explore. Curated listings, up-to-date contacts, and videos.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate:
            "https://lovemallacoota.com.au/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    };
    appendSchema(schema);
  }

  /**
   * Injects an ItemList schema for a category page, embedding LocalBusiness data.
   * @param {Array} items - The array of business items for the category.
   * @param {string} pageTitle - The title for the CollectionPage.
   * @param {string} pageUrl - The canonical URL for the page.
   */
  function injectCategorySchema(items, pageTitle, pageUrl) {
    const itemListElements = items.map((item, index) => {
      // Get hero image or first image
      const heroImage =
        (item.images || []).find((img) => img.is_hero) ||
        (item.images || [])[0];
      const imageUrl = heroImage
        ? `https://lovemallacoota.com.au${heroImage.url}`
        : undefined;

      // Get website link
      const webUrl = getPrimaryLink(item);

      // Create the core LocalBusiness schema
      const businessSchema = {
        "@type": item.schema_type || "LocalBusiness",
        name: item.business_name,
        description: item.description_long || item.description_short,
        image: imageUrl,
        url: webUrl,
        telephone: item.phone
          ? String(item.phone).replace(/\s+/g, "")
          : undefined,
        email: item.email ? item.email : undefined,
        address: item.address
          ? {
              "@type": "PostalAddress",
              streetAddress: item.address.street,
              addressLocality: item.address.locality,
              addressRegion: item.address.state,
              postalCode: item.address.postcode,
              addressCountry: "AU",
            }
          : undefined,
        geo: item.geo
          ? {
              "@type": "GeoCoordinates",
              latitude: item.geo.latitude,
              longitude: item.geo.longitude,
            }
          : undefined,
        openingHoursSpecification:
          item.opening_hours_specification || item.opening_hours || undefined,
      };

      // Clean up any keys that are undefined
      Object.keys(businessSchema).forEach(
        (key) =>
          (businessSchema[key] === undefined || businessSchema[key] === null) &&
          delete businessSchema[key]
      );

      // Return the ListItem for the ItemList
      return {
        "@type": "ListItem",
        position: index + 1,
        item: businessSchema,
      };
    });

    // Create the top-level CollectionPage schema
    const collectionSchema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: pageTitle,
      url: pageUrl,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: itemListElements,
      },
    };

    appendSchema(collectionSchema);
  }
});
