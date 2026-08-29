// Secrets and bindings that the generated types do not cover.
// Set with:
//   npx wrangler secret put TURNSTILE_SECRET_KEY --env=""
//   npx wrangler secret put RELAY_KEY --env=""
//   npx wrangler secret put GITHUB_TOKEN --env=""      # contents:write on the repo
interface Env {
  TURNSTILE_SECRET_KEY?: string;
  RELAY_KEY?: string;
  GITHUB_TOKEN?: string;
  DB?: D1Database;
  LISTING_RATE?: RateLimit;
  CONTACT_RATE?: RateLimit;
}
