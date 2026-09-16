// Secrets and bindings that the generated types do not cover.
// Set with:
//   npx wrangler secret put TURNSTILE_SECRET_KEY --env=""
//   npx wrangler secret put RELAY_KEY --env=""
//   npx wrangler secret put GITHUB_TOKEN --env=""      # contents:write on the repo
//   npx wrangler secret put STRIPE_WEBHOOK_SECRET --env=""
//   npx wrangler secret put RESEND_API_KEY --env=""    # verification codes
//   npx wrangler secret put ADNET_EVENT_KEY --env=""   # conversions counted on ads.oze.net.au
interface Env {
  TURNSTILE_SECRET_KEY?: string;
  RELAY_KEY?: string;
  ADNET_EVENT_KEY?: string;
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
  /*
   * Which button was pressed, so a payment is filed by what it was for rather
   * than by its amount. All optional: without them classifyPayment falls back
   * to the shape of the payment, which is right until a price changes.
   */
  /** The plink_… id of the advertising link. */
  STRIPE_AD_PAYMENT_LINK?: string;
  /** The plink_… id of the $10 supporter link. */
  STRIPE_SUPPORTER_PAYMENT_LINK?: string;
  /** Every donate link's plink_… id, comma separated: the presets and the open one. */
  STRIPE_DONATION_PAYMENT_LINKS?: string;
  /*
   * One Stripe link per offered amount, so /donate?amount=20 opens ready to pay
   * rather than on the open link's editable field. Any amount without a link
   * falls back to STRIPE_LINK_DONATE, so a new amount can be offered before its
   * link exists. Keep in step with DONATE_PRESETS in src/worker.ts.
   */
  /*
   * The donate form opens on the site rather than on Stripe's own page, which
   * needs a secret key (a Worker secret, never a var) and the price behind each
   * offered amount. Without them /api/checkout answers 503 and every button
   * falls back to being an ordinary link to its payment link.
   */
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_DONATE_OPEN?: string;
  STRIPE_PRICE_DONATE_10?: string;
  STRIPE_PRICE_DONATE_20?: string;
  STRIPE_PRICE_DONATE_50?: string;
  STRIPE_PRICE_DONATE_100?: string;
  CHECKOUT_RATE?: RateLimit;
  STRIPE_LINK_DONATE_10?: string;
  STRIPE_LINK_DONATE_20?: string;
  STRIPE_LINK_DONATE_50?: string;
  STRIPE_LINK_DONATE_100?: string;
  DB?: D1Database;
  LISTING_RATE?: RateLimit;
  CONTACT_RATE?: RateLimit;
}
