/*
# Project:     lovemallacoota.au
# File Name:   contact.ts
# Description: Server side of the suggest-an-update form. The browser posts here
#              instead of calling an email provider directly, so the sending
#              credentials stay on the server, every submission has to clear a
#              Turnstile challenge, and one bot cannot drain the month's quota.
*/

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Field name → label used in the email body, in the order they are shown. */
const FIELDS: Array<[string, string]> = [
  ["business", "Business or organisation"],
  ["reason", "Reason for contact"],
  ["url", "URL"],
  ["notes", "Notes"],
  ["user_name", "Name"],
  ["user_email", "Email"],
  ["user_phone", "Phone"],
  ["from_page", "Submitted from"],
];

const REQUIRED = ["business", "user_name", "user_email"];
const MAX_FIELD_LENGTH = 4000;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] as string
  );
}

async function verifyTurnstile(token: string, secret: string, ip: string | null) {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);

  const response = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body });
  // Cloudflare answers a bad secret with 400 and puts the reason in the body,
  // so the body is read whatever the status. Returning early on !response.ok
  // threw away the one field that says what is wrong.
  const outcome = (await response
    .json()
    .catch(() => ({ success: false, "error-codes": [`http-${response.status}`] }))) as {
    success?: boolean;
    "error-codes"?: string[];
  };
  if (outcome.success !== true) {
    // See the note in listing.ts: the codes are the difference between a wrong
    // secret and a stale token, and they name no secret.
    console.error("turnstile rejected", JSON.stringify(outcome["error-codes"] ?? []));
  }
  return outcome.success === true;
}

export async function handleContactSubmit(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Use POST." }, 405);
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    // Fail closed. An unprotected form is how the quota gets drained.
    return json({ ok: false, error: "The form is not configured yet." }, 503);
  }

  const ip = request.headers.get("CF-Connecting-IP");

  // Cheap check first, so a flood costs one rate-limiter call and nothing else.
  if (env.CONTACT_RATE) {
    const { success } = await env.CONTACT_RATE.limit({ key: ip || "unknown" });
    if (!success) {
      return json({ ok: false, error: "Too many submissions. Try again shortly." }, 429);
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Could not read the form." }, 400);
  }

  // Hidden field. A person never fills it in; naive bots fill in everything.
  if (String(form.get("website") || "").trim() !== "") {
    return json({ ok: true }, 200);
  }

  const token = String(form.get("cf-turnstile-response") || "");
  // See the note in listing.ts: a widget that never produced a token is not the
  // same fault as a token that was refused, and used to look identical.
  if (!token) {
    console.error("no turnstile token in the submission — the widget did not produce one");
    return json({ ok: false, error: "The verification box did not load. Reload the page and try again." }, 403);
  }
  if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip))) {
    return json({ ok: false, error: "Verification failed. Reload the page and try again." }, 403);
  }

  const values = new Map<string, string>();
  for (const [name] of FIELDS) {
    const value = String(form.get(name) || "").trim();
    if (value.length > MAX_FIELD_LENGTH) {
      return json({ ok: false, error: `${name} is too long.` }, 400);
    }
    if (value) values.set(name, value);
  }

  for (const name of REQUIRED) {
    if (!values.has(name)) {
      return json({ ok: false, error: "Please fill in the required fields." }, 400);
    }
  }

  const replyTo = values.get("user_email") as string;
  if (!looksLikeEmail(replyTo)) {
    return json({ ok: false, error: "That email address does not look right." }, 400);
  }

  const rows = FIELDS.filter(([name]) => values.has(name)).map(
    ([name, label]) => [label, values.get(name) as string] as const
  );
  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html = `<h2>Directory update from lovemallacoota.au</h2><dl>${rows
    .map(([label, value]) => `<dt><strong>${escapeHTML(label)}</strong></dt><dd>${escapeHTML(value)}</dd>`)
    .join("")}</dl>`;

  if (!env.RELAY_KEY) {
    return json({ ok: false, error: "The form is not configured yet." }, 503);
  }

  try {
    const relayed = await fetch(env.RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RELAY_KEY}`,
      },
      body: JSON.stringify({
        site: "lovemallacoota",
        subject: `Directory update: ${values.get("business")}`,
        replyTo,
        text,
        html,
      }),
    });
    if (!relayed.ok) {
      console.error("relay rejected the submission", relayed.status, await relayed.text());
      return json({ ok: false, error: "Could not send your update. Please try again." }, 502);
    }
  } catch (error) {
    console.error("contact submit failed", error);
    return json({ ok: false, error: "Could not send your update. Please try again." }, 502);
  }

  return json({ ok: true }, 200);
}
