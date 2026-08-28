// Secrets are not part of the generated binding types, so declare them here.
// Set with: npx wrangler secret put TURNSTILE_SECRET_KEY
interface Env {
  TURNSTILE_SECRET_KEY?: string;
}
