// Secrets are not part of the generated binding types, so declare them here.
// Set with:
//   npx wrangler secret put TURNSTILE_SECRET_KEY --env=""
//   npx wrangler secret put RELAY_KEY --env=""
interface Env {
  TURNSTILE_SECRET_KEY?: string;
  RELAY_KEY?: string;
}
