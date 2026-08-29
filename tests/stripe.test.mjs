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
