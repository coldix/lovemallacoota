/*
# Project:     lovemallacoota.au
# File Name:   checkout.ts
# Description: Creates the Stripe Checkout session behind the donate buttons, so
#              the payment form opens on this site instead of sending the reader
#              to a Stripe page. The secret key stays on the server; the browser
#              is handed nothing but a client secret that is good for one
#              session.
*/

const STRIPE_SESSIONS_URL = "https://api.stripe.com/v1/checkout/sessions";

/**
 * Offered amounts, and the Stripe price behind each. Kept as vars rather than
 * in code so a price can be replaced without a deploy, and read through this
 * map rather than by building a var name out of what the browser sent.
 */
function priceFor(amount: string | null, env: Env): string | null {
  const vars = env as unknown as Record<string, string | undefined>;
  if (!amount) return vars.STRIPE_PRICE_DONATE_OPEN || null;
  if (!/^[0-9]{1,4}$/.test(amount)) return null;
  return vars[`STRIPE_PRICE_DONATE_${Number(amount)}`] || null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * Only this site may open a session. Without the check any page anywhere could
 * post here and run up Stripe sessions in our name; they cost nothing and take
 * no money, but they are ours and they are rate limited.
 */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function handleCheckoutSession(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Use POST." }, 405);
  }

  if (!sameOrigin(request)) {
    return json({ error: "Not allowed from here." }, 403);
  }

  // No key, no session. The buttons are ordinary links to /donate?amount=…
  // until the browser is told otherwise, so a 503 here costs the reader
  // nothing: the click falls through to the Stripe payment link.
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Checkout is not configured." }, 503);
  }

  const body = (await request.json().catch(() => null)) as { amount?: unknown } | null;
  if (!body) return json({ error: "Expected a JSON body." }, 400);

  const amount = typeof body.amount === "string" && body.amount ? body.amount : null;
  const price = priceFor(amount, env);
  if (!price) return json({ error: "That amount is not offered." }, 400);

  if (env.CHECKOUT_RATE) {
    const key = request.headers.get("CF-Connecting-IP") || "unknown";
    const { success } = await env.CHECKOUT_RATE.limit({ key });
    if (!success) return json({ error: "Too many attempts. Try again in a minute." }, 429);
  }

  const origin = new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: "payment",
    ui_mode: "embedded",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    // The reader chose Australian dollars by being on an Australian town's
    // website. Stripe otherwise offers a converted local currency beside the
    // real price, which reads as a second decision to make.
    "adaptive_pricing[enabled]": "false",
    // Says "Donate" on the button rather than "Pay".
    submit_type: "donate",
    return_url: `${origin}/thanks.html?type=donate&session_id={CHECKOUT_SESSION_ID}`,
    // What this payment was for, recorded on the payment itself. A session
    // opened here has no payment link to be recognised by, and an amount is
    // only a guess: ten dollars once and ten dollars a month are the same
    // number (see classifyPayment in stripe-webhook.ts).
    "metadata[kind]": "donation",
    "payment_intent_data[metadata][kind]": "donation",
  });

  const created = await fetch(STRIPE_SESSIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const session = (await created.json().catch(() => ({}))) as {
    client_secret?: string;
    error?: { message?: string };
  };

  if (!created.ok || !session.client_secret) {
    // Stripe's own wording is for us, not for the reader: it names prices and
    // parameters. The browser falls back to the payment link on any failure,
    // so what matters here is that the status says to.
    console.error("Stripe checkout session failed:", session.error?.message || created.status);
    return json({ error: "Could not start checkout." }, 502);
  }

  return json({ clientSecret: session.client_secret }, 200);
}
