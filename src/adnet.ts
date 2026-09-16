/*
# Project:     lovemallacoota.au
# File Name:   adnet.ts
# Description: Tell the oze ad network something happened here — an article
#              published, a listing confirmed, a payment made. A kind and an
#              opaque id go; no name, address or email ever does.
*/

const EVENT_URL = "https://ads.oze.net.au/event";
const SITE = "lovemallacoota";
/** A slow network must not hold a contributor's confirmation; the count is not worth that. */
const TIMEOUT_MS = 1_500;

export type ConversionKind = "article" | "listing" | "payment";

/**
 * Reports one conversion to ads.oze.net.au, which keeps the network-wide count and
 * sends the Monday digest. Inert until ADNET_EVENT_KEY is set; never throws.
 */
export async function reportConversion(
  env: { ADNET_EVENT_KEY?: string },
  kind: ConversionKind,
  ref?: string | null,
  valueCents?: number | null
): Promise<void> {
  if (!env.ADNET_EVENT_KEY) return;
  try {
    const response = await fetch(EVENT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.ADNET_EVENT_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        site: SITE,
        kind,
        ref: ref ?? undefined,
        value_cents: valueCents ?? undefined,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) console.warn("adnet did not record the conversion", response.status);
  } catch (error) {
    console.warn("adnet unreachable", error instanceof Error ? error.message : String(error));
  }
}
