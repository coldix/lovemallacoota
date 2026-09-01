import { handleAdminApprove, handleAdminPending, handleAdminReject } from "./admin.ts";
import { handleContactSubmit } from "./contact.ts";
import { handleEditionPdf, weekFromPath } from "./edition-pdf.ts";
import { handleListingManage, handleListingSubmit, handleListingVerify } from "./listing.ts";
import { handleArticleSubmit } from "./submit.ts";
import { handleStripeWebhook } from "./stripe-webhook.ts";

const CANONICAL_HOST = "lovemallacoota.au";

/** Clean paths that hand off to Stripe. */
const PAYMENT_PATHS: Record<string, "STRIPE_LINK_DONATE" | "STRIPE_LINK_SUBSCRIBE" | "STRIPE_LINK_ADVERTISE"> = {
  "/donate": "STRIPE_LINK_DONATE",
  "/subscribe": "STRIPE_LINK_SUBSCRIBE",
  "/advertise": "STRIPE_LINK_ADVERTISE",
};

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
  // Local of the Week is an article inside the weekly edition, not a product of
  // its own. The archive indexes every profile and keeps the anchors the old
  // page used, so /locals.html#article-… still lands on the right story: a
  // fragment is never sent to the server, and the browser carries it across a
  // redirect whose Location has none of its own.
  ["/locals.html", "/archive.html"],
  ["/locals", "/archive.html"],
  ["/eat-drink", "/food.html"],
  ["/stay", "/accom.html"],
  ["/do-see", "/activity.html"],
  ["/calendar", "/calendar.html"],
  ["/contact", "/contact.html"],
  ["/food", "/food.html"],
  ["/accommodation", "/accom.html"],
  ["/activities", "/activity.html"],
  ["/archive", "/archive.html"],
  ["/community", "/community.html"],
  ["/services", "/services.html"],
  ["/directory", "/directory.html"],
  ["/add-listing", "/add-listing.html"],
  ["/claim", "/claim.html"],
  ["/listing", "/directory.html"],
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
  if (normalized.startsWith("/category/")) {
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
 *   kuula.co            the weekly three-sixty view
 *   cloudflareinsights  the analytics beacon Cloudflare injects at the edge,
 *                       which the policy blocked until it was named here
 *   calendar.google.com the What's On embed
 * 'unsafe-inline' for scripts is regrettable and load-bearing: the theme
 * flash-guard, the analytics config and the page-level handlers are all inline
 * script blocks. Removing it means giving every one of them a nonce, which the
 * static build cannot do without rendering each page through the Worker.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://ads.oze.net.au https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://ads.oze.net.au https://www.google-analytics.com",
  // challenges.cloudflare.com belongs here as well as in script-src and
  // frame-src. Turnstile loads its script, builds its container, and then calls
  // home to start the challenge — and that last call was blocked, so the widget
  // died without an iframe, without a token and without an error. Every form on
  // the site failed from launch until 31 August 2026 for this reason.
  "connect-src 'self' https://challenges.cloudflare.com https://ads.oze.net.au https://www.google-analytics.com https://region1.google-analytics.com https://cloudflareinsights.com https://static.cloudflareinsights.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com https://calendar.google.com https://challenges.cloudflare.com https://kuula.co",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

function applySecurityHeaders(response: Response, hostname?: string): Response {
  const secured = new Response(response.body, response);
  // The preview worker and the workers.dev hostname serve the production HTML.
  // The canonical tag points home, but a crawler should not have to take that
  // on trust: anything not on the real domain is told plainly not to index.
  if (hostname && hostname !== CANONICAL_HOST) {
    secured.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
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

    // Short paths to the Stripe payment links. The URLs are vars rather than
    // code so they can be replaced without a source change, and the redirect is
    // temporary because a payment link can be regenerated.
    const payment = PAYMENT_PATHS[url.pathname];
    if (payment) {
      const target = env[payment];
      if (target) return Response.redirect(target, 302);
      return applySecurityHeaders(
        new Response("That payment link is not configured yet.", { status: 503 })
      );
    }

    if (url.pathname === "/api/stripe") {
      return applySecurityHeaders(await handleStripeWebhook(request, env));
    }

    if (url.pathname === "/api/article") {
      return applySecurityHeaders(await handleArticleSubmit(request, env));
    }

    if (url.pathname === "/api/listing") {
      return applySecurityHeaders(await handleListingSubmit(request, env));
    }

    if (url.pathname === "/api/listing/verify") {
      return applySecurityHeaders(await handleListingVerify(request, env));
    }

    if (url.pathname === "/api/listing/manage") {
      return applySecurityHeaders(await handleListingManage(request, env));
    }

    if (url.pathname === "/api/admin/pending") {
      return applySecurityHeaders(await handleAdminPending(request, env));
    }

    if (url.pathname === "/api/admin/approve") {
      return applySecurityHeaders(await handleAdminApprove(request, env));
    }

    if (url.pathname === "/api/admin/reject") {
      return applySecurityHeaders(await handleAdminReject(request, env));
    }

    if (weekFromPath(url.pathname)) {
      return applySecurityHeaders(await handleEditionPdf(request, env, ctx), url.hostname);
    }

    const assetRequest = url.pathname === "/"
      ? new Request(new URL(`/index.html${url.search}`, url), request)
      : request;
    const response = await env.ASSETS.fetch(assetRequest);
    return applySecurityHeaders(response, url.hostname);
  },
} satisfies ExportedHandler<Env>;
