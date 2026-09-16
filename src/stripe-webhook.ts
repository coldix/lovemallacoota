/*
# Project:     lovemallacoota.au
# File Name:   stripe-webhook.ts
# Description: POST /api/stripe — Stripe tells us an advertisement has been
#              booked, and we open a draft for it rather than leaving the
#              booking to be noticed in an inbox.
#
#              The signature is verified before anything is read as meaningful.
#              A webhook endpoint that trusts its body is an open door: anyone
#              who finds the URL could otherwise book free advertising.
*/

import { reportConversion } from "./adnet.ts";

const TOLERANCE_SECONDS = 300;
const OWNER = "coldix";
const REPO = "lovemallacoota";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant time, so a wrong signature cannot be found one character at a time. */
function matches(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export function parseSignatureHeader(header: string | null) {
  if (!header) return null;
  const parts = Object.create(null) as Record<string, string[]>;
  for (const piece of header.split(",")) {
    const [key, value] = piece.split("=", 2);
    if (!key || !value) continue;
    (parts[key.trim()] ||= []).push(value.trim());
  }
  const timestamp = Number(parts.t?.[0]);
  const signatures = parts.v1 || [];
  if (!Number.isFinite(timestamp) || !signatures.length) return null;
  return { timestamp, signatures };
}

/**
 * Stripe signs `timestamp.body` with the endpoint's secret. The timestamp is
 * checked too: a valid signature replayed a week later is still an attack.
 */
export async function verifyStripeSignature(
  body: string,
  header: string | null,
  secret: string,
  now = Math.floor(Date.now() / 1000)
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: "No usable Stripe-Signature header." };
  if (Math.abs(now - parsed.timestamp) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "Signature timestamp is outside the tolerance." };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${parsed.timestamp}.${body}`)
  );
  const expected = hex(signed);

  return parsed.signatures.some((candidate) => matches(candidate, expected))
    ? { ok: true }
    : { ok: false, reason: "Signature does not match." };
}

/**
 * Which of the three things was paid for. All three arrive as the same event
 * type, so without this a ten dollar donation is filed as a thirty-five dollar
 * advertising booking — which is how the first real donation would have been
 * recorded.
 *
 * The payment link decides it wherever one is configured: that is a record of
 * which button was pressed, where an amount is only a guess about it. Naming a
 * price in two places is its own trap - raise the supporter price to twelve
 * dollars and every supporter silently refiles as a donation - so the amounts
 * below are the fallback, not the rule. Donations have several links, one per
 * offered amount plus the open one, so that var is a comma-separated list.
 */
export function classifyPayment(object: Record<string, any>, env?: Env): "advertising" | "supporter" | "donation" | "unknown" {
  // A session opened by the form on our own page says what it is for, because
  // we put it there (see checkout.ts). It has no payment link to be recognised
  // by, and its amount is the reader's choice.
  const declared = object.metadata?.kind;
  if (declared === "donation" || declared === "supporter" || declared === "advertising") {
    return declared;
  }

  const link = typeof object.payment_link === "string" ? object.payment_link : object.payment_link?.id;
  if (link) {
    if (env?.STRIPE_AD_PAYMENT_LINK && link === env.STRIPE_AD_PAYMENT_LINK) return "advertising";
    if (env?.STRIPE_SUPPORTER_PAYMENT_LINK && link === env.STRIPE_SUPPORTER_PAYMENT_LINK) return "supporter";
    if (donationLinks(env).includes(link)) return "donation";
  }

  const amount = typeof object.amount_total === "number" ? object.amount_total / 100 : null;
  const recurring = object.mode === "subscription";

  if (recurring && amount === 35) return "advertising";
  if (recurring && amount === 10) return "supporter";
  if (!recurring && amount !== null) return "donation";
  if (recurring) return "supporter";
  return "unknown";
}

/** Every donate link - one per offered amount, plus the open one - as a list. */
function donationLinks(env?: Env): string[] {
  return (env?.STRIPE_DONATION_PAYMENT_LINKS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** What we keep about a booking. Deliberately not the card, or anything near it. */
export function bookingFromEvent(event: Record<string, any>, env?: Env) {
  const object = event?.data?.object || {};
  const details = object.customer_details || {};
  return {
    kind: classifyPayment(object, env),
    id: object.id || event.id,
    eventId: event.id,
    type: event.type,
    bookedAt: new Date((event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    name: details.name || object.customer_name || null,
    email: details.email || object.customer_email || null,
    amount: typeof object.amount_total === "number" ? object.amount_total / 100 : null,
    currency: (object.currency || "aud").toUpperCase(),
    recurring: object.mode === "subscription",
    status: "new",
  };
}

async function commitBooking(env: Env, booking: Record<string, any>) {
  const path = `data/ad-bookings/${booking.id}.json`;
  const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const body = `${JSON.stringify(booking, null, 2)}\n`;
  const response = await fetch(api, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "lovemallacoota-worker",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Advertisement booked: ${booking.name || booking.email || booking.id}`,
      content: btoa(String.fromCharCode(...new TextEncoder().encode(body))),
    }),
  });
  if (!response.ok && response.status !== 422) {
    // 422 means it already exists — Stripe retried, and that is fine.
    throw new Error(`Cannot record the booking: ${response.status}`);
  }
}

const SUBJECTS: Record<string, string> = {
  advertising: "Advertisement booked",
  supporter: "New monthly supporter",
  donation: "Someone chipped in",
  unknown: "Stripe payment received",
};

async function notify(env: Env, booking: Record<string, any>) {
  if (!env.RELAY_KEY || !env.RELAY_URL) return;
  const lines = [
    `Kind: ${booking.kind}`,
    `From: ${booking.name || "not given"}`,
    `Email: ${booking.email || "not given"}`,
    `Amount: ${booking.amount ?? "?"} ${booking.currency}${booking.recurring ? " a month" : ""}`,
    `Booked: ${booking.bookedAt}`,
    "",
    booking.kind === "advertising"
      ? "A draft is in data/ad-bookings. Build the advertisement, show them, then add it to the edition."
      : "Nothing to do - this is money in, not work to schedule.",
  ];
  await fetch(env.RELAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.RELAY_KEY}` },
    body: JSON.stringify({
      site: "lovemallacoota",
      subject: `${SUBJECTS[booking.kind] || SUBJECTS.unknown}: ${booking.name || booking.email || "someone"}`,
      replyTo: booking.email || undefined,
      text: lines.join("\n"),
    }),
  });
}

/** Events that mean an advertisement has been paid for. */
const BOOKING_EVENTS = new Set(["checkout.session.completed", "invoice.paid"]);

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ ok: false, error: "Webhook is not configured." }, 503);
  }

  const body = await request.text();
  const verified = await verifyStripeSignature(
    body,
    request.headers.get("Stripe-Signature"),
    env.STRIPE_WEBHOOK_SECRET
  );
  if (!verified.ok) {
    console.warn("stripe webhook rejected:", verified.reason);
    return json({ ok: false, error: verified.reason }, 401);
  }

  let event: Record<string, any>;
  try {
    event = JSON.parse(body);
  } catch {
    return json({ ok: false, error: "Body is not JSON." }, 400);
  }

  // Anything else is acknowledged and ignored: Stripe should not retry an
  // event we simply do not act on.
  if (!BOOKING_EVENTS.has(event.type)) return json({ ok: true, ignored: event.type }, 200);

  const booking = bookingFromEvent(event, env);

  // A supporter or a one-off contribution needs no draft and no work: say
  // thank you by email and stop. Only advertising has something to build.
  if (booking.kind !== "advertising") {
    await notify(env, booking);
    return json({ ok: true, recorded: booking.id, kind: booking.kind }, 200);
  }

  if (!env.GITHUB_TOKEN) {
    // Fail loudly rather than swallow a paid booking: Stripe will retry, and
    // the booking is recorded once the token exists.
    console.error("booking received with no way to record it", booking.id);
    return json({ ok: false, error: "Cannot record the booking yet." }, 503);
  }

  try {
    await commitBooking(env, booking);
    await notify(env, booking);
  } catch (error) {
    console.error("stripe webhook failed", error);
    return json({ ok: false, error: (error as Error).message }, 500);
  }
  await reportConversion(
    env,
    "payment",
    String(booking.id),
    typeof booking.amount === "number" ? Math.round(booking.amount * 100) : null
  );

  return json({ ok: true, recorded: booking.id }, 200);
}
