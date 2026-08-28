/*
# Project:     lovemallacoota.au
# File Name:   edition-pdf.ts
# Description: /edition/<week>.pdf — renders a weekly edition to PDF with
#              Browser Rendering, from the edition's own page, so print and web
#              cannot drift apart and the table of contents is the same one.
#              See docs/WEEKLY-MOUTH.md.
*/

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
      pdf = await tab.pdf({
        format: "a4",
        printBackground: false,
        margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate:
          '<div style="width:100%;font-size:9px;color:#555;padding:0 16mm;display:flex;justify-content:space-between">' +
          '<span>lovemallacoota.au</span><span class="pageNumber"></span></div>',
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
