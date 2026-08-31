// Secrets and bindings that the generated types do not cover.
// Set with:
//   npx wrangler secret put TURNSTILE_SECRET_KEY --env=""
//   npx wrangler secret put RELAY_KEY --env=""
//   npx wrangler secret put GITHUB_TOKEN --env=""      # contents:write on the repo
//   npx wrangler secret put STRIPE_WEBHOOK_SECRET --env=""
//   npx wrangler secret put RESEND_API_KEY --env=""    # verification codes
interface Env {
  TURNSTILE_SECRET_KEY?: string;
  RELAY_KEY?: string;
  GITHUB_TOKEN?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /**
   * Transactional sending, for codes that must reach a stranger. The relay
   * cannot: it sends to one fixed address, through Email Routing, which only
   * delivers to addresses verified on the account.
   */
  RESEND_API_KEY?: string;
  /** e.g. "Love Mallacoota <noreply@lovemallacoota.au>". A plain var, not a secret. */
  MAIL_FROM?: string;
  /** Optional: the plink_… id of the advertising link, for exact matching. */
  STRIPE_AD_PAYMENT_LINK?: string;
  DB?: D1Database;
  LISTING_RATE?: RateLimit;
  CONTACT_RATE?: RateLimit;
}
