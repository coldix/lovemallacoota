/*
# Project:     lovemallacoota.au
# File Name:   edition-pdf.ts
# Description: /edition/<week>.pdf — renders a weekly edition to PDF with
#              Browser Rendering, from the edition's own page, so print and web
#              cannot drift apart and the table of contents is the same one.
#              See docs/WEEKLY-MOUTH.md.
*/

import { OZE_LOGO_DATA_URI } from "./oze-logo.ts";

const WEEK = /^\/edition\/(\d{4}-w\d{2})\.pdf$/;

/**
 * A frozen edition never changes, so the render is worth caching hard. An open
 * week still changes as articles land, so it gets a short cache instead.
 */
const CACHE_SECONDS_FROZEN = 60 * 60 * 24 * 365;
const CACHE_SECONDS_OPEN = 60 * 10;

export function weekFromPath(pathname: string): string | null {
  const match = WEEK.exec(pathname);
  return match ? match[1] : null;
}

/** The edition page this PDF is rendered from. */
export function editionPageUrl(origin: string, week: string): string {
  return `${origin}/edition/${week}.html`;
}

export function pdfFilename(week: string): string {
  return `mallacoota-${week}.pdf`;
}

/** Issue number and cover date, read from the page rather than recomputed. */
function editionDetails(html: string): { issue: string; date: string } {
  const issue = /Edition (\d{2}:\d{2})/.exec(html)?.[1] ?? "";
  const date = /Week of ([0-9]{1,2} [A-Za-z]+ [0-9]{4})/.exec(html)?.[1] ?? "";
  return { issue, date };
}

/**
 * The running footer, on every page after the cover: where it came from, who
 * made it, which issue it is, and the page number.
 */
function footer(week: string, html: string): string {
  const { issue, date } = editionDetails(html);
  const middle = [date, issue && `Issue ${issue}`].filter(Boolean).join(" · ");
  return (
    '<div style="width:100%;font-size:8px;color:#555;padding:0 10mm;' +
    'display:flex;align-items:center;justify-content:space-between;font-family:Roboto,Helvetica,Arial,sans-serif">' +
    '<span style="display:flex;align-items:center;gap:4px">' +
    '<span style="font-weight:600;color:#333">lovemallacoota.au</span>' +
    `<span>· ${middle}</span></span>` +
    '<span style="display:flex;align-items:center;gap:4px">' +
    '<span>A project by oze.au</span>' +
    `<img src="${OZE_LOGO_DATA_URI}" style="height:9px;width:auto;vertical-align:middle" />` +
    '<span style="margin-left:6px" class="pageNumber"></span>' +
    '</span></div>'
  );
}

export async function handleEditionPdf(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const week = weekFromPath(url.pathname);
  if (!week) return new Response("Not found", { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  // caches.default is a workerd extension the DOM CacheStorage type omits, and
  // is absent entirely outside the runtime. The cache is an optimisation, so
  // its absence must not stop the render.
  const cache =
    typeof caches === "undefined"
      ? null
      : (caches as unknown as { default: Cache }).default;
  const cached = cache ? await cache.match(request) : undefined;
  if (cached) return cached;

  // The page is the source of truth. If it does not exist, neither does the PDF.
  const pageUrl = editionPageUrl(url.origin, week);
  const page = await env.ASSETS.fetch(new Request(pageUrl));
  if (!page.ok) return new Response("No such edition", { status: 404 });
  const html = await page.text();
  const isOpen = html.includes("contributions for this week are still being accepted");

  if (!env.BROWSER) {
    return new Response("PDF rendering is not configured.", { status: 503 });
  }

  let pdf: Uint8Array;
  try {
    // Imported here rather than at module scope so the route's validation can
    // be tested outside the Workers runtime.
    const { default: puppeteer } = await import("@cloudflare/puppeteer");
    const browser = await puppeteer.launch(env.BROWSER);
    try {
      const tab = await browser.newPage();
      await tab.goto(pageUrl, { waitUntil: "networkidle0" });

      // Images are lazy on the web, and a headless render never scrolls, so
      // every picture below the fold would print as an empty caption. Make
      // them eager and wait for the browser to actually have them.
      // This function is serialised and run inside the page, not in the Worker,
      // so its globals are the browser's rather than workerd's.
      await tab.evaluate(async () => {
        const page = globalThis as unknown as {
          document: {
            querySelectorAll: (selector: string) => ArrayLike<Record<string, any>>;
            fonts?: { ready: Promise<unknown> };
          };
        };
        const images = [...page.document.querySelectorAll("img")] as Record<string, any>[];
        for (const image of images) {
          image.loading = "eager";
          if (!image.complete) image.src = image.src;
        }
        await Promise.all(
          images.map((image) =>
            image.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  image.addEventListener("load", () => resolve(), { once: true });
                  image.addEventListener("error", () => resolve(), { once: true });
                })
          )
        );
        await page.document.fonts?.ready;
      });
      pdf = await tab.pdf({
        // The stylesheet owns the page size and margins so the cover can bleed
        // to the edge while the content pages keep their margins.
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate: footer(week, html),
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("edition pdf render failed", error);
    return new Response("Could not produce the PDF.", { status: 502 });
  }

  const response = new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFilename(week)}"`,
      "Cache-Control": `public, max-age=${isOpen ? CACHE_SECONDS_OPEN : CACHE_SECONDS_FROZEN}`,
    },
  });

  if (cache) ctx.waitUntil(cache.put(request, response.clone()));
  return response;
}
