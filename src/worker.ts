const CANONICAL_HOST = "lovemallacoota.au";

const REDIRECT_HOSTS = new Set([
  "www.lovemallacoota.au",
  "lovemallacoota.com.au",
  "www.lovemallacoota.com.au",
  "lovemallacoota.com",
  "www.lovemallacoota.com",
]);

const MOVED_PATHS = new Map([
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

function applySecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response);
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set("X-Frame-Options", "SAMEORIGIN");
  return secured;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const movedPath = resolveMovedPath(url.pathname);

    if (movedPath) {
      url.pathname = movedPath;
    }

    if (REDIRECT_HOSTS.has(url.hostname) || movedPath) {
      return redirectToCanonical(url);
    }

    const assetRequest = url.pathname === "/"
      ? new Request(new URL(`/index.html${url.search}`, url), request)
      : request;
    const response = await env.ASSETS.fetch(assetRequest);
    return applySecurityHeaders(response);
  },
} satisfies ExportedHandler<Env>;
