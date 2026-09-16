import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";

import {
  bookingFromEvent,
  parseSignatureHeader,
  verifyStripeSignature,
} from "../src/stripe-webhook.ts";

const SECRET = "whsec_test_secret_value";
const sign = (body, timestamp) =>
  createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex");

const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

test("a genuine signature passes", async () => {
  const now = 1756500000;
  const header = `t=${now},v1=${sign(body, now)}`;
  assert.deepEqual(await verifyStripeSignature(body, header, SECRET, now), { ok: true });
});

test("a forged signature is refused", async () => {
  const now = 1756500000;
  const header = `t=${now},v1=${"0".repeat(64)}`;
  const result = await verifyStripeSignature(body, header, SECRET, now);
  assert.equal(result.ok, false);
});

test("a tampered body invalidates a real signature", async () => {
  const now = 1756500000;
  const header = `t=${now},v1=${sign(body, now)}`;
  const tampered = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", amount: 1 });
  const result = await verifyStripeSignature(tampered, header, SECRET, now);
  assert.equal(result.ok, false);
});

test("a replayed signature expires", async () => {
  const signedAt = 1756500000;
  const header = `t=${signedAt},v1=${sign(body, signedAt)}`;
  const muchLater = signedAt + 60 * 60;
  const result = await verifyStripeSignature(body, header, SECRET, muchLater);
  assert.equal(result.ok, false);
  assert.match(result.reason, /tolerance/);
});

test("the wrong secret does not verify", async () => {
  const now = 1756500000;
  const header = `t=${now},v1=${createHmac("sha256", "whsec_other").update(`${now}.${body}`).digest("hex")}`;
  assert.equal((await verifyStripeSignature(body, header, SECRET, now)).ok, false);
});

test("a missing or malformed header is refused, not ignored", async () => {
  assert.equal((await verifyStripeSignature(body, null, SECRET)).ok, false);
  assert.equal((await verifyStripeSignature(body, "nonsense", SECRET)).ok, false);
  assert.equal(parseSignatureHeader("t=123"), null);
});

test("Stripe's rolled-secret form, with two signatures, still verifies", async () => {
  const now = 1756500000;
  const header = `t=${now},v1=${"a".repeat(64)},v1=${sign(body, now)}`;
  assert.deepEqual(await verifyStripeSignature(body, header, SECRET, now), { ok: true });
});

test("a booking keeps the details we need and nothing near a card", () => {
  const booking = bookingFromEvent({
    id: "evt_2",
    type: "checkout.session.completed",
    created: 1756500000,
    data: {
      object: {
        id: "cs_123",
        mode: "subscription",
        amount_total: 3500,
        currency: "aud",
        customer_details: { name: "Alf's Pizza", email: "alf@example.com" },
        payment_method: { card: { last4: "4242" } },
      },
    },
  });
  assert.equal(booking.id, "cs_123");
  assert.equal(booking.name, "Alf's Pizza");
  assert.equal(booking.amount, 35);
  assert.equal(booking.currency, "AUD");
  assert.equal(booking.recurring, true);
  assert.equal(booking.status, "new");
  assert.ok(!JSON.stringify(booking).includes("4242"), "card details must not be kept");
});

test("a payment is classified before anything is filed", async () => {
  const { classifyPayment } = await import("../src/stripe-webhook.ts");

  // The three real products.
  assert.equal(classifyPayment({ mode: "subscription", amount_total: 3500 }), "advertising");
  assert.equal(classifyPayment({ mode: "subscription", amount_total: 1000 }), "supporter");
  assert.equal(classifyPayment({ mode: "payment", amount_total: 1000 }), "donation");

  // The case that prompted this: a ten dollar donation must never be filed as
  // an advertising booking.
  assert.notEqual(classifyPayment({ mode: "payment", amount_total: 1000 }), "advertising");

  // An explicit payment link wins over the amount.
  assert.equal(
    classifyPayment({ payment_link: "plink_ad", mode: "payment", amount_total: 1 }, { STRIPE_AD_PAYMENT_LINK: "plink_ad" }),
    "advertising"
  );
});

test("the payment link decides the kind, whatever the amount happens to be", async () => {
  const { classifyPayment } = await import("../src/stripe-webhook.ts");
  const env = {
    STRIPE_AD_PAYMENT_LINK: "plink_ad",
    STRIPE_SUPPORTER_PAYMENT_LINK: "plink_supporter",
    STRIPE_DONATION_PAYMENT_LINKS: "plink_d5, plink_d25 ,plink_open",
  };

  // Thirty-five dollars is the advertising price, but this one came from a
  // donate button, and that is what it is.
  assert.equal(classifyPayment({ payment_link: "plink_d25", mode: "payment", amount_total: 3500 }, env), "donation");
  // A supporter whose price has risen is still a supporter.
  assert.equal(classifyPayment({ payment_link: "plink_supporter", mode: "subscription", amount_total: 1200 }, env), "supporter");
  // Stripe expands the link to an object on some events.
  assert.equal(classifyPayment({ payment_link: { id: "plink_ad" }, mode: "subscription", amount_total: 3500 }, env), "advertising");
  // Whitespace around an id in the list is tolerated.
  assert.equal(classifyPayment({ payment_link: "plink_d5", mode: "payment", amount_total: 500 }, env), "donation");
  // A link we do not know falls back to the shape of the payment.
  assert.equal(classifyPayment({ payment_link: "plink_new", mode: "subscription", amount_total: 3500 }, env), "advertising");
});

test("only advertising creates work; the rest are just thanks", async () => {
  const { bookingFromEvent } = await import("../src/stripe-webhook.ts");
  const donation = bookingFromEvent({
    id: "evt_d",
    type: "checkout.session.completed",
    created: 1756500000,
    data: { object: { id: "cs_d", mode: "payment", amount_total: 1000, currency: "aud", customer_details: { email: "someone@example.com" } } },
  });
  assert.equal(donation.kind, "donation");

  const ad = bookingFromEvent({
    id: "evt_a",
    type: "checkout.session.completed",
    created: 1756500000,
    data: { object: { id: "cs_a", mode: "subscription", amount_total: 3500, currency: "aud", customer_details: { name: "A Business" } } },
  });
  assert.equal(ad.kind, "advertising");
});

test("a session opened by the form on our own page says what it is for", async () => {
  const { classifyPayment } = await import("../src/stripe-webhook.ts");
  const env = { STRIPE_AD_PAYMENT_LINK: "plink_ad", STRIPE_SUPPORTER_PAYMENT_LINK: "plink_supporter" };

  // Embedded checkout carries no payment link, and the amount is the reader's
  // own: thirty-five dollars once is not an advertising booking.
  assert.equal(
    classifyPayment({ mode: "payment", amount_total: 3500, metadata: { kind: "donation" } }, env),
    "donation"
  );
  // Ten dollars a month is the supporter price; a ten dollar donation is not.
  assert.equal(
    classifyPayment({ mode: "payment", amount_total: 1000, metadata: { kind: "donation" } }, env),
    "donation"
  );
  // Anything we did not write ourselves is ignored, and the old rules decide.
  assert.equal(
    classifyPayment({ mode: "subscription", amount_total: 3500, metadata: { kind: "nonsense" } }, env),
    "advertising"
  );
  assert.equal(classifyPayment({ mode: "payment", amount_total: 2000, metadata: {} }, env), "donation");
});

test("the checkout endpoint refuses anything it should not start a session for", async () => {
  const { handleCheckoutSession } = await import("../src/checkout.ts");
  const configured = {
    STRIPE_SECRET_KEY: "sk_test_not_used",
    STRIPE_PRICE_DONATE_OPEN: "price_open",
    STRIPE_PRICE_DONATE_20: "price_20",
  };
  const post = (body, init = {}) =>
    new Request("https://lovemallacoota.au/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://lovemallacoota.au", ...(init.headers || {}) },
      body: JSON.stringify(body),
    });

  // Not configured yet: the buttons are still links to the payment links, so
  // this must fail in a way the browser can fall back from.
  assert.equal((await handleCheckoutSession(post({ amount: "20" }), {})).status, 503);

  // Another site may not open sessions in our name.
  const elsewhere = await handleCheckoutSession(
    post({ amount: "20" }, { headers: { Origin: "https://example.com" } }),
    configured
  );
  assert.equal(elsewhere.status, 403);

  // Nor may a request that brings no origin at all.
  const noOrigin = new Request("https://lovemallacoota.au/api/checkout", {
    method: "POST",
    body: JSON.stringify({ amount: "20" }),
  });
  assert.equal((await handleCheckoutSession(noOrigin, configured)).status, 403);

  assert.equal(
    (await handleCheckoutSession(new Request("https://lovemallacoota.au/api/checkout"), configured)).status,
    405
  );

  // An amount we do not offer has no price, and neither does an attempt to
  // read another var through the amount.
  for (const amount of ["7", "25", "20.5", "abc", "__proto__", "20 ", "SECRET_KEY"]) {
    const response = await handleCheckoutSession(post({ amount }), configured);
    assert.equal(response.status, 400, `amount=${amount} should be refused`);
  }
});
