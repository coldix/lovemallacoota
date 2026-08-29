import { handleContactSubmit } from "./contact.ts";
import { handleEditionPdf, weekFromPath } from "./edition-pdf.ts";
import { handleArticleSubmit } from "./submit.ts";

const CANONICAL_HOST = "lovemallacoota.au";

const REDIRECT_HOSTS = new Set([
  "www.lovemallacoota.au",
  "lovemallacoota.com.au",
  "www.lovemallacoota.com.au",
  "lovemallacoota.com",
  "www.lovemallacoota.com",
]);

const MOVED_PATHS = new Map([
  // /index.html and / served the same page, which is duplicate content.
  ["/index.html", "/"],
  ["/eat-drink", "/food.html"],
  ["/stay", "/accom.html"],
  ["/do-see", "/activity.html"],
  ["/calendar", "/calendar.html"],
  ["/contact", "/contact.html"],
  ["/food", "/food.html"],
  ["/accommodation", "/accom.html"],
  ["/activities", "/activity.html"],
  ["/archive", "/archive.html"],
  ["/listing", "/"],
  ["/category", "/"],
  ["/category/news", "/"],
  ["/category/how", "/"],
  ["/category/what", "/"],
  ["/category/where", "/"],
  ["/category/who", "/"],
  ["/category/why", "/"],
]);

function pathWithoutTrailingSlash(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function resolveMovedPath(pathname: string): string | undefined {
  const normalized = pathWithoutTrailingSlash(pathname);
  const exact = MOVED_PATHS.get(normalized);
  if (exact) return exact;
  if (normalized.startsWith("/listing/") || normalized.startsWith("/category/")) {
    return "/";
  }
  return undefined;
}

function redirectToCanonical(url: URL): Response {
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return Response.redirect(url.toString(), 301);
}

/**
 * Everything the site actually loads, and nothing else. Each entry is here
 * because a feature needs it:
 *   Google Fonts        the typefaces
 *   Google Analytics    the tag and its beacons
 *   ads.oze.net.au      the house ad tag, its decisions and its artwork
 *   challenges.…        Turnstile on the contact form
 *   YouTube, Maps       the two embeds on the home page
 * 'unsafe-inline' for scripts is regrettable and load-bearing: the theme
 * flash-guard, the analytics config and the page-level handlers are all inline
 * script blocks. Removing it means giving every one of them a nonce, which the
 * static build cannot do without rendering each page through the Worker.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://ads.oze.net.au https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://ads.oze.net.au https://www.google-analytics.com",
  "connect-src 'self' https://ads.oze.net.au https://www.google-analytics.com https://region1.google-analytics.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com https://challenges.cloudflare.com",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

function applySecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response);
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set("X-Frame-Options", "SAMEORIGIN");
  // Two years, subdomains included. No preload: that is a one-way door and
  // belongs to whoever owns the domain, not to a deploy script.
  secured.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  secured.headers.set("Content-Security-Policy", CSP);
  return secured;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const movedPath = resolveMovedPath(url.pathname);

    if (movedPath) {
      url.pathname = movedPath;
    }

    if (REDIRECT_HOSTS.has(url.hostname) || movedPath) {
      return redirectToCanonical(url);
    }

    if (url.pathname === "/api/submit") {
      return applySecurityHeaders(await handleContactSubmit(request, env));
    }

    if (url.pathname === "/api/article") {
      return applySecurityHeaders(await handleArticleSubmit(request, env));
    }

    if (weekFromPath(url.pathname)) {
      return applySecurityHeaders(await handleEditionPdf(request, env, ctx));
    }

    const assetRequest = url.pathname === "/"
      ? new Request(new URL(`/index.html${url.search}`, url), request)
      : request;
    const response = await env.ASSETS.fetch(assetRequest);
    return applySecurityHeaders(response);
  },
} satisfies ExportedHandler<Env>;
