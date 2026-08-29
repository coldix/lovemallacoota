/*
# Project:     lovemallacoota.au
# Author:      Colin Dixon BSc, DipEd, Cert IV TAE
# Contact:     crdixon@gmail.com
# Assistant:   Claude Fable 5
# Timestamp:   14/07/2026 10:30 PM AEST (Mallacoota)
# Version:     [26.07.001]
# File Name:   script.js
# Description: Aurora coastal behaviours — theme toggle, random photo backdrop,
#              scroll reveals, floating motes, card cursor-glow, live search and
#              tag filtering over the build-time listing cards, home-page stat
#              count-up, footer version stamp. Listing markup and JSON-LD are
#              rendered by Astro, not here.
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

  (function initNavMenu() {
    const toggle = document.getElementById("nav-menu-toggle");
    const menu = document.getElementById("nav-menu");
    if (!toggle || !menu) return;

    const setOpen = (open) => {
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close the rest of the menu" : "Open the rest of the menu");
    };

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpen(menu.hidden);
    });
    document.addEventListener("click", (event) => {
      if (menu.hidden) return;
      if (event.target.closest(".nav-more")) return;
      setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });
  })();

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
  // Directory filtering
  //
  // Cards and their JSON-LD are rendered by Astro at build time. This only
  // filters what is already in the page, so the listings are visible to
  // crawlers and to anyone whose JavaScript never runs.
  // =====================================================================

  (function initListingFilters() {
    const grid = document.getElementById("listings-grid");
    if (!grid) return;
    const cards = [...grid.querySelectorAll(".listing-card")];
    if (!cards.length) return;

    const tagRow = document.getElementById("tag-row");
    const sectionRow = document.getElementById("section-row");
    const typeRow = document.getElementById("type-row");
    const searchInput = document.getElementById("listing-search");
    const countEl = document.getElementById("result-count");
    const emptyEl = document.getElementById("no-results");
    const noun = grid.dataset.noun || "places";
    let activeTag = "All";
    let activeSection = "All";
    let activeType = "All";

    const render = () => {
      const q = (searchInput?.value || "").trim().toLowerCase();
      let shown = 0;
      for (const card of cards) {
        const tags = (card.dataset.tags || "").split("|");
        const tagOK = activeTag === "All" || tags.includes(activeTag);
        const sectionOK = activeSection === "All" || card.dataset.section === activeSection;
        const typeOK = activeType === "All" || card.dataset.type === activeType;
        const searchOK = !q || (card.dataset.search || "").includes(q);
        const visible = tagOK && sectionOK && typeOK && searchOK;
        // The [hidden] attribute is not enough on its own: .listing-card sets
        // display:flex, which beats the user-agent [hidden] { display:none }.
        card.hidden = !visible;
        if (visible) shown += 1;
      }
      if (emptyEl) emptyEl.hidden = shown > 0;
      if (countEl) countEl.textContent = `Showing ${shown} of ${cards.length} ${noun}`;
    };

    const bindRow = (row, key, assign) => {
      row?.addEventListener("click", (e) => {
        const btn = e.target.closest(".tag-btn");
        if (!btn || !btn.dataset[key]) return;
        assign(btn.dataset[key]);
        row.querySelectorAll(".tag-btn").forEach((b) => b.classList.toggle("active", b === btn));
        render();
      });
    };
    bindRow(tagRow, "tag", (value) => { activeTag = value; });
    bindRow(sectionRow, "section", (value) => { activeSection = value; });
    bindRow(typeRow, "type", (value) => { activeType = value; });
    searchInput?.addEventListener("input", render);
    render();
  })();

  // --- Home page: count up to the build-time totals ---
  (function initStats() {
    if (reduceMotion) return;
    document.querySelectorAll("#stats-row [data-count]").forEach((el) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target) || target <= 0) return;
      const t0 = performance.now();
      const dur = 1100;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  })();

  // --- Print this edition ---
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-print-edition]")) window.print();
  });

  // --- Suggest-link handler (delegated) ---
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".suggest-link");
    if (!btn) return;
    const bname = btn.getAttribute("data-bname") || "Business";
    window.location.href = `contact.html?business=${encodeURIComponent(bname)}&from=${encodeURIComponent(location.href)}`;
  });
});
