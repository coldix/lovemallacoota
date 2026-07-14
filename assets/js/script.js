/*
# Project:     lovemallacoota.com.au
# Author:      Colin Dixon BSc, DipEd, Cert IV TAE
# Contact:     crdixon@gmail.com
# Assistant:   Claude Fable 5
# Timestamp:   14/07/2026 10:30 PM AEST (Mallacoota)
# Version:     [26.07.001]
# File Name:   script.js
# Description: Aurora coastal behaviours — theme toggle, random photo backdrop,
#              scroll reveals, floating motes, card cursor-glow, directory
#              rendering with live search + tag filters, home-page stats,
#              LocalBusiness schema injection, footer version stamp.
*/

document.addEventListener("DOMContentLoaded", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const html = document.documentElement;

  // --- Theme ---
  const themeToggle = document.getElementById("theme-toggle");
  const sunIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
  const moonIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  const applyTheme = (theme) => {
    html.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    if (themeToggle) {
      themeToggle.innerHTML = theme === "dark" ? sunIcon : moonIcon;
      themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      themeToggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
    }
  };
  themeToggle?.addEventListener("click", () => {
    applyTheme(html.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });
  applyTheme(
    localStorage.getItem("theme") ||
      (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
  );

  // --- Random sunrise backdrop (per visit) ---
  (function setRandomBackground() {
    const n = 1 + Math.floor(Math.random() * 6);
    const photo = `/images/background-0${n}.webp`;
    document.querySelector(".bg-field")?.style.setProperty("--bg-photo", `url('${photo}')`);
  })();

  // --- Footer year + version stamp ---
  document.querySelectorAll(".copyright-year").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
  (async function setVersionStamp() {
    const stamp = document.getElementById("build-stamp");
    if (!stamp) return;
    try {
      const res = await fetch("/data/site-version.json", { cache: "no-store" });
      if (!res.ok) return;
      const v = await res.json();
      if (v.version) stamp.textContent = `${v.version} · ${v.generatedAt || ""}`;
    } catch {
      /* stamp stays empty — non-critical */
    }
  })();

  // --- Scroll reveal ---
  const revealEls = document.querySelectorAll(".reveal");
  let revealObserver = null;
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            revealObserver.unobserve(e.target);
          }
        });
      },
      // threshold 0 so very tall sections (full listings grid) still trigger
      { threshold: 0, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  // --- Card cursor glow (delegated — works for dynamically added cards) ---
  if (!reduceMotion) {
    document.addEventListener("mousemove", (e) => {
      const card = e.target.closest?.(".link-card, .listing-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }

  // --- Floating light motes ---
  const canvas = document.getElementById("motes");
  if (canvas && canvas.getContext && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    let w, h, motes = [];
    const COUNT = Math.min(46, Math.floor(window.innerWidth / 26));
    const rand = (a, b) => a + Math.random() * (b - a);
    const seed = () =>
      (motes = Array.from({ length: COUNT }, () => ({
        x: rand(0, w), y: rand(0, h), r: rand(0.6, 2.4),
        vy: rand(0.08, 0.5), vx: rand(-0.15, 0.15),
        a: rand(0.12, 0.5), tw: rand(0.005, 0.02), tp: rand(0, 6.28),
      })));
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      seed();
    };
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.vy; m.x += m.vx; m.tp += m.tw;
        if (m.y < -6) { m.y = h + 6; m.x = rand(0, w); }
        const flicker = m.a * (0.6 + 0.4 * Math.sin(m.tp));
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, 6.2832);
        ctx.fillStyle = `rgba(170,225,255,${flicker})`;
        ctx.fill();
      }
      requestAnimationFrame(tick);
    };
    window.addEventListener("resize", resize);
    resize();
    tick();
  }

  // =====================================================================
  // Directory data + rendering
  // =====================================================================

  const PAGE_DATA = {
    "food.html": {
      files: ["data/listings_food.json"],
      pageTitle: "Eat & Drink in Mallacoota",
      pageUrl: "https://lovemallacoota.com.au/food.html",
    },
    "accom.html": {
      files: ["data/listings_accom.json"],
      pageTitle: "Stay in Mallacoota",
      pageUrl: "https://lovemallacoota.com.au/accom.html",
    },
    "activity.html": {
      files: ["data/listings_do.json", "data/listings_other.json"],
      pageTitle: "Do & See in Mallacoota",
      pageUrl: "https://lovemallacoota.com.au/activity.html",
    },
  };

  const getPrimaryLink = (b) => {
    if (Array.isArray(b.links) && b.links.length) {
      const site = b.links.find((l) => (l.text || "").toLowerCase() === "website") || b.links[0];
      return site?.url;
    }
    if (Array.isArray(b.social_links) && b.social_links.length) return b.social_links[0].url;
    return null;
  };

  const formatAddress = (addr) => {
    if (!addr) return "";
    return [addr.street, addr.locality].filter(Boolean).join(", ");
  };

  const escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  function buildLinksHTML(b) {
    const links = [];
    const primary = getPrimaryLink(b);
    if (primary) {
      const label =
        (Array.isArray(b.links) && b.links.find((l) => l.url === primary)?.text) || "Website";
      links.push(
        `<a href="${escapeHTML(primary)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`
      );
    } else {
      links.push(
        `<button type="button" class="suggest-link" data-bname="${escapeHTML(
          b.business_name || "Business"
        )}">Suggest Link</button>`
      );
    }
    if (b.geo?.latitude && b.geo?.longitude) {
      const { latitude: lat, longitude: lng } = b.geo;
      links.push(
        `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener noreferrer">Map</a>`
      );
      links.push(
        `<a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener noreferrer">Directions</a>`
      );
    } else if (b.address) {
      const q = encodeURIComponent(
        [b.address.street, b.address.locality, b.address.state, b.address.postcode]
          .filter(Boolean)
          .join(", ")
      );
      links.push(
        `<a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener noreferrer">Map</a>`
      );
    }
    if (b.phone) {
      links.push(`<a href="tel:${String(b.phone).replace(/\s+/g, "")}">Call</a>`);
    }
    if (b.email) {
      links.push(`<a href="mailto:${escapeHTML(b.email)}">Email</a>`);
    }
    return `<div class="links">${links.join("")}</div>`;
  }

  const createListingCard = (b) => {
    const card = document.createElement("article");
    card.className = "listing-card";
    const addressText = formatAddress(b.address);
    const tags =
      Array.isArray(b.category_tags) && b.category_tags.length
        ? `<div class="chips">${b.category_tags
            .filter((t) => !/^(food & drink|accommodation|activities)$/i.test(t))
            .map((t) => `<span class="chip">${escapeHTML(t)}</span>`)
            .join("")}</div>`
        : "";
    const desc = b.description_short || b.description_long || "No description available.";
    card.innerHTML = `
      <h3>${escapeHTML(b.business_name || "Unnamed Business")}</h3>
      ${tags}
      <p class="desc">${escapeHTML(desc)}</p>
      ${addressText ? `<p class="addr">📍 ${escapeHTML(addressText)}</p>` : ""}
      ${buildLinksHTML(b)}
    `;
    return card;
  };

  // --- Listing pages: fetch, filter, render ---
  async function initListings() {
    const grid = document.getElementById("listings-grid");
    if (!grid) return;
    const page = PAGE_DATA[window.location.pathname.split("/").pop()];
    if (!page) return;

    let businesses = [];
    try {
      const responses = await Promise.all(page.files.map((url) => fetch(url)));
      const payloads = await Promise.all(
        responses.map((res) => (res.ok ? res.json() : Promise.resolve([])))
      );
      businesses = payloads
        .flat()
        .filter(Boolean)
        .sort((a, b) => (a.business_name || "").localeCompare(b.business_name || ""));
    } catch (err) {
      console.error("Error loading listings:", err);
      grid.innerHTML = '<p class="no-results">Sorry, there was an error loading the listings.</p>';
      return;
    }

    if (businesses.length) injectCategorySchema(businesses, page.pageTitle, page.pageUrl);

    // Build tag filter row from data
    const tagRow = document.getElementById("tag-row");
    const searchInput = document.getElementById("listing-search");
    const countEl = document.getElementById("result-count");
    let activeTag = "All";

    const GENERIC = /^(food & drink|accommodation|activities|other)$/i;
    if (tagRow) {
      const tagCounts = new Map();
      businesses.forEach((b) =>
        (b.category_tags || []).forEach((t) => {
          if (!GENERIC.test(t)) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
        })
      );
      const tags = [...tagCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 12)
        .map(([t]) => t);
      tagRow.innerHTML = ["All", ...tags]
        .map(
          (t) =>
            `<button type="button" class="tag-btn${t === "All" ? " active" : ""}" data-tag="${escapeHTML(t)}">${escapeHTML(t)}</button>`
        )
        .join("");
      tagRow.addEventListener("click", (e) => {
        const btn = e.target.closest(".tag-btn");
        if (!btn) return;
        activeTag = btn.dataset.tag;
        tagRow.querySelectorAll(".tag-btn").forEach((b) => b.classList.toggle("active", b === btn));
        render();
      });
    }

    searchInput?.addEventListener("input", render);

    function render() {
      const q = (searchInput?.value || "").trim().toLowerCase();
      const filtered = businesses.filter((b) => {
        const tagOK =
          activeTag === "All" || (b.category_tags || []).some((t) => t === activeTag);
        if (!tagOK) return false;
        if (!q) return true;
        const hay = [
          b.business_name,
          b.description_short,
          b.description_long,
          ...(b.category_tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });

      grid.innerHTML = "";
      if (!filtered.length) {
        grid.innerHTML = '<p class="no-results">No matches — try a different search or tag.</p>';
      } else {
        filtered.forEach((b) => grid.appendChild(createListingCard(b)));
      }
      if (countEl) {
        countEl.textContent = `Showing ${filtered.length} of ${businesses.length} places`;
      }
    }

    render();
  }
  initListings();

  // --- Home page: live stats from the directory data ---
  (async function initStats() {
    const statsRow = document.getElementById("stats-row");
    if (!statsRow) return;
    const files = [
      ["stat-food", ["data/listings_food.json"]],
      ["stat-stay", ["data/listings_accom.json"]],
      ["stat-do", ["data/listings_do.json", "data/listings_other.json"]],
    ];
    for (const [id, urls] of files) {
      try {
        const payloads = await Promise.all(
          urls.map((u) => fetch(u).then((r) => (r.ok ? r.json() : [])))
        );
        const count = payloads.flat().filter(Boolean).length;
        const el = document.getElementById(id);
        if (el && count) animateCount(el, count);
      } catch {
        /* stat stays as fallback text */
      }
    }
    function animateCount(el, target) {
      if (reduceMotion) { el.textContent = target; return; }
      const t0 = performance.now();
      const dur = 1100;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  })();

  // --- Suggest-link handler (delegated) ---
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".suggest-link");
    if (!btn) return;
    const bname = btn.getAttribute("data-bname") || "Business";
    window.location.href = `contact.html?business=${encodeURIComponent(bname)}&from=${encodeURIComponent(location.href)}`;
  });

  // =====================================================================
  // Schema.org JSON-LD injection
  // =====================================================================

  function appendSchema(schema) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  const path = window.location.pathname.split("/").pop();
  if (path === "" || path === "index.html") {
    appendSchema({
      "@context": "https://schema.org",
      "@type": "WebSite",
      url: "https://lovemallacoota.com.au/",
      name: "Love Mallacoota",
      description:
        "Your local guide to Mallacoota — places to eat, stay, and explore. Curated listings, up-to-date contacts, and videos.",
    });
  }

  function injectCategorySchema(items, pageTitle, pageUrl) {
    const itemListElements = items.map((item, index) => {
      const heroImage =
        (item.images || []).find((img) => img.is_hero) || (item.images || [])[0];
      const businessSchema = {
        "@type": item.schema_type || "LocalBusiness",
        name: item.business_name,
        description: item.description_long || item.description_short,
        image: heroImage ? `https://lovemallacoota.com.au${heroImage.url}` : undefined,
        url: getPrimaryLink(item) || undefined,
        telephone: item.phone ? String(item.phone).replace(/\s+/g, "") : undefined,
        email: item.email || undefined,
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
      Object.keys(businessSchema).forEach(
        (key) =>
          (businessSchema[key] === undefined || businessSchema[key] === null) &&
          delete businessSchema[key]
      );
      return { "@type": "ListItem", position: index + 1, item: businessSchema };
    });

    appendSchema({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: pageTitle,
      url: pageUrl,
      mainEntity: { "@type": "ItemList", itemListElement: itemListElements },
    });
  }
});
