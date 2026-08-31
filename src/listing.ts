/*
# Project:     lovemallacoota.au
# File Name:   listing.ts
# Description: Directory add / claim / verify / manage / event APIs.
#              Email is verified with a code. Nothing unpublished goes live.
#              Official entities cannot be claimed. Tokens are stored hashed.
*/

import community from "../data/listings_community.json" with { type: "json" };
import enrichment from "../data/directory-enrichment.json" with { type: "json" };
import food from "../data/listings_food.json" with { type: "json" };
import stay from "../data/listings_accom.json" with { type: "json" };
import doSee from "../data/listings_do.json" with { type: "json" };
import services from "../data/listings_services.json" with { type: "json" };
import associationsSeed from "../docs/incorporated-associations.json" with { type: "json" };
import { canSendToPeople, sendToPerson } from "./mailer.ts";

import {
  ENTITY_TYPES,
  FORM_ENTITY_TYPES,
  SECTIONS,
  assembleEntities,
  canClaim,
  isOfficialEntity,
  looksLikeEmail,
  looksLikeHttpUrl,
  plainText,
  slugify,
} from "./lib/directory-model.mjs";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const OWNER = "coldix";
const REPO = "lovemallacoota";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};
function typeInfo(id: string) {
  return (ENTITY_TYPES as Record<string, (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES] | undefined>)[id];
}

function sectionInfo(id: string) {
  return (SECTIONS as Record<string, (typeof SECTIONS)[keyof typeof SECTIONS] | undefined>)[id];
}

const CODE_TTL_MS = 15 * 60 * 1000;
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function melbourneDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
}

function nowIso(): string {
  return new Date().toISOString();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomDigits(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => String(byte % 10)).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
    // Cloudflare says exactly why, and this used to throw it away — leaving
    // "Verification failed" with no way to tell a wrong secret from a stale
    // token. The codes name no secret and are safe to log.
    //   invalid-input-secret   the secret does not match the site key on the page
    //   invalid-input-response the token is malformed
    //   timeout-or-duplicate   the token expired or was already used
    console.error("turnstile rejected", JSON.stringify(outcome["error-codes"] ?? []));
  }
  return outcome.success === true;
}

function directoryEntities() {
  return assembleEntities({
    food,
    stay,
    doSee,
    community,
    services,
    associations: (associationsSeed as { associations?: unknown[] }).associations || [],
    enrichment,
  });
}

/**
 * A listing by slug, whether it shipped with the build or was added through the
 * form since. The five listing JSON files are bundled into the Worker at deploy
 * time; anything submitted after that lives under data/directory/ in the
 * deployed assets, which is where this Worker itself put it.
 *
 * Looking only at the bundle meant a listing added through the form could not
 * be claimed, could not have an event attached, and did not register as a
 * duplicate — the directory was one-way, and claiming your own new listing
 * answered "We could not find that listing".
 */
async function findEntity(env: Env, slug: string): Promise<DirectoryEntity | null> {
  const bundled = directoryEntities().find((entity: DirectoryEntity) => entity.slug === slug);
  if (bundled) return bundled;
  // The slug reaches a URL, so it is checked rather than trusted, even though
  // every caller slugifies first.
  if (!/^[a-z0-9-]{1,120}$/.test(slug) || !env.ASSETS) return null;
  try {
    const response = await env.ASSETS.fetch(
      new Request(`https://lovemallacoota.au/data/directory/${slug}.json`)
    );
    if (!response.ok) return null;
    const [entity] = assembleEntities({ submitted: [await response.json()] });
    return (entity as DirectoryEntity) ?? null;
  } catch {
    return null;
  }
}

function requireDb(env: Env): D1Database | null {
  return env.DB ?? null;
}

/**
 * A confirmation code goes to the person who typed the address, so it cannot go
 * through the relay — the relay sends to the site's own inbox by design, and
 * Email Routing behind it will not deliver to an unverified stranger anyway.
 */
async function sendCode(
  env: Env,
  to: string,
  payload: { subject: string; text: string; html: string }
): Promise<boolean> {
  const result = await sendToPerson(env, { to, replyTo: undefined, ...payload });
  return result.ok;
}

async function sendMail(
  env: Env,
  payload: { subject: string; replyTo?: string; text: string; html: string }
): Promise<boolean> {
  if (!env.RELAY_KEY) {
    console.error("relay key is not set on this Worker");
    return false;
  }
  const relayed = await fetch(env.RELAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RELAY_KEY}`,
    },
    body: JSON.stringify({ site: "lovemallacoota", ...payload }),
  });
  if (!relayed.ok) {
    // The contact form logged this and the listing form did not, so a failed
    // code email said only "Could not send the code" with nothing behind it.
    // 401 here means this Worker's key and the relay's key are different.
    console.error("relay rejected the mail", relayed.status, (await relayed.text()).slice(0, 200));
  }
  return relayed.ok;
}

async function putGithubFile(env: Env, filePath: string, content: string, message: string) {
  if (!env.GITHUB_TOKEN) throw new Error("Publishing is not configured yet.");
  const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "lovemallacoota-worker",
  };
  const current = await fetch(api, { headers });
  const existing = current.ok ? ((await current.json()) as { sha?: string }) : null;
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const written = await fetch(api, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: btoa(binary),
      sha: existing?.sha,
    }),
  });
  if (!written.ok) throw new Error(`Cannot write ${filePath}: ${written.status}`);
}

async function stageListingPhoto(env: Env, file: File, slug: string, submittedBy: string) {
  const extension = IMAGE_TYPES[file.type];
  if (!extension) return { ok: false as const, error: "Photographs must be JPEG, PNG, WebP or HEIC." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false as const, error: "That photograph is over 12MB." };
  const name = `${slug}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = `${JSON.stringify({ kind: "listing", slug, file: name, submittedBy, alt: slug }, null, 2)}\n`;
  await writeGithubBinary(env, `uploads/${name}`, bytes, `Stage listing photo ${name}`);
  await putGithubFile(env, `uploads/${slug}.json`, meta, `Describe listing photo ${name}`);
  return { ok: true as const };
}

async function writeGithubBinary(env: Env, filePath: string, bytes: Uint8Array, message: string) {
  const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "lovemallacoota-worker",
    "Content-Type": "application/json",
  };
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const current = await fetch(api, { headers });
  const existing = current.ok ? ((await current.json()) as { sha?: string }) : null;
  const written = await fetch(api, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message, content: btoa(binary), sha: existing?.sha }),
  });
  if (!written.ok) throw new Error(`Cannot write ${filePath}: ${written.status}`);
}

async function guardForm(request: Request, env: Env): Promise<FormData | Response> {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  if (!env.TURNSTILE_SECRET_KEY) return json({ ok: false, error: "The form is not configured yet." }, 503);
  const ip = request.headers.get("CF-Connecting-IP");
  const limiter = env.LISTING_RATE || env.CONTACT_RATE;
  if (limiter) {
    const { success } = await limiter.limit({ key: ip || "unknown" });
    if (!success) return json({ ok: false, error: "Too many submissions. Try again shortly." }, 429);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Could not read the form." }, 400);
  }
  // The honeypot answers a bot with a plausible success so it stops trying. A
  // person who trips it gets the same answer and waits for an email that was
  // never sent, so it is logged: this fired once for Colin, whose password
  // manager filled the trap when it was still called "website".
  if (String(form.get("lm_leave_blank") || "").trim() !== "") {
    console.error("honeypot tripped — submission discarded, nothing was written or sent");
    return json({ ok: true }, 200);
  }
  const token = String(form.get("cf-turnstile-response") || "");
  // No token at all is a different fault from a rejected one: the widget never
  // ran, or never finished, so nothing was submitted to check. It used to
  // short-circuit into the same silent 403 as a bad token, which made a broken
  // widget look identical to a wrong secret.
  if (!token) {
    console.error("no turnstile token in the submission — the widget did not produce one");
    return json({ ok: false, error: "The verification box did not load. Reload the page and try again." }, 403);
  }
  if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip))) {
    return json({ ok: false, error: "Verification failed. Reload the page and try again." }, 403);
  }
  return form;
}

function listingFromForm(form: FormData, slug: string) {
  const entityType = String(form.get("entityType") || "other");
  const section = String(form.get("section") || typeInfo(entityType)?.sectionHint || "community");
  const website = String(form.get("website_url") || "").trim();
  const facebook = String(form.get("facebook") || "").trim();
  const street = plainText(String(form.get("street") || ""), 160);
  return {
    id: slug,
    slug,
    name: plainText(String(form.get("name") || ""), 160),
    commonName: plainText(String(form.get("commonName") || ""), 120) || null,
    entityType: (FORM_ENTITY_TYPES as readonly string[]).includes(entityType) ? entityType : "other",
    section: sectionInfo(section) ? section : "community",
    categories: [],
    description: plainText(String(form.get("description") || ""), 1200),
    descriptionShort: plainText(String(form.get("description") || ""), 220),
    address: street
      ? {
          street,
          locality: plainText(String(form.get("locality") || "Mallacoota"), 80),
          state: "VIC",
          postcode: "3892",
          country: "Australia",
        }
      : null,
    serviceArea: plainText(String(form.get("serviceArea") || ""), 160) || null,
    phone: plainText(String(form.get("phone") || ""), 40) || null,
    email: String(form.get("email") || "").trim().toLowerCase() || null,
    website: looksLikeHttpUrl(website) ? website : null,
    links: looksLikeHttpUrl(website) ? [{ url: website, text: "Website" }] : [],
    social: looksLikeHttpUrl(facebook) ? [{ platform: "facebook", url: facebook }] : [],
    openingHours: [],
    meetingTimes: plainText(String(form.get("meetingTimes") || ""), 400) || null,
    notes_seasonal: plainText(String(form.get("openingHours") || ""), 400) || null,
    accessibility: plainText(String(form.get("accessibility") || ""), 300) || null,
    images: [],
    status: "published",
    claimable: !typeInfo(entityType)?.official,
    official: Boolean(typeInfo(entityType)?.official),
    source: { kind: "submitted", note: "Submitted through Add your listing." },
    verification: {
      email: {
        value: String(form.get("email") || "").trim().toLowerCase(),
        verifiedAt: null as string | null,
        method: "emailed-code",
      },
      lastReviewedAt: null as string | null,
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function requireReadyDb(env: Env): D1Database {
  if (!env.DB) throw new Error("The directory database is not configured.");
  return env.DB;
}

async function createCode(env: Env, submissionId: string, email: string): Promise<string> {
  const code = randomDigits();
  const salt = randomToken();
  await requireReadyDb(env).prepare(
    `INSERT INTO codes (id, submission_id, email, code_hash, salt, attempts, expires_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  )
    .bind(
      crypto.randomUUID(),
      submissionId,
      email,
      await sha256Hex(`${salt}:${code}`),
      salt,
      new Date(Date.now() + CODE_TTL_MS).toISOString()
    )
    .run();
  return code;
}

async function createManageToken(env: Env, slug: string, email: string): Promise<string> {
  const token = randomToken();
  await requireReadyDb(env).prepare(
    `INSERT INTO tokens (id, listing_slug, email, token_hash, purpose, expires_at, created_at)
     VALUES (?, ?, ?, ?, 'manage', ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      slug,
      email,
      await sha256Hex(token),
      new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      nowIso()
    )
    .run();
  return token;
}

async function audit(env: Env, action: string, detail: Record<string, unknown>) {
  await requireReadyDb(env).prepare(
    `INSERT INTO audit (id, listing_slug, submission_id, action, actor, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      String(detail.slug || ""),
      String(detail.submissionId || ""),
      action,
      String(detail.actor || ""),
      JSON.stringify(detail),
      nowIso()
    )
    .run();
}

export async function handleListingSubmit(request: Request, env: Env): Promise<Response> {
  const guarded = await guardForm(request, env);
  if (guarded instanceof Response) return guarded;
  const form = guarded;
  const db = requireDb(env);
  if (!db) return json({ ok: false, error: "The directory is not configured yet." }, 503);
  // Refuse before anything is written. A submission stored with no way to send
  // its code is a row that can never be completed and a person left waiting.
  if (!canSendToPeople(env)) {
    console.error("submission refused: the mailer is not configured, so no code could be sent");
    return json({ ok: false, error: "The form is not configured to send confirmation codes yet." }, 503);
  }

  if (String(form.get("authorised") || "") !== "yes") {
    return json({ ok: false, error: "You need to confirm you are authorised to maintain this listing." }, 400);
  }

  const kind = String(form.get("kind") || "add");
  if (kind === "claim") return handleClaim(form, env);
  if (kind === "event") return handleEvent(form, env);
  if (kind !== "add") return json({ ok: false, error: "Unknown submission type." }, 400);

  const name = plainText(String(form.get("name") || ""), 160);
  const email = String(form.get("email") || "").trim().toLowerCase();
  const entityType = String(form.get("entityType") || "");
  if (!name || !looksLikeEmail(email)) {
    return json({ ok: false, error: "Name and a real public email are required." }, 400);
  }
  if (!(FORM_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return json({ ok: false, error: "Choose what you are listing." }, 400);
  }
  if (typeInfo(entityType)?.official) {
    return json(
      {
        ok: false,
        error:
          "Official government and emergency listings cannot be added here. Use Suggest a correction if something is wrong.",
      },
      400
    );
  }

  const slug = slugify(String(form.get("commonName") || name));
  const existing = await findEntity(env, slug);
  if (existing) {
    return json(
      {
        ok: false,
        error: "A listing with that name already exists. Claim it instead of adding a duplicate.",
        slug,
      },
      409
    );
  }

  const website = String(form.get("website_url") || "").trim();
  const facebook = String(form.get("facebook") || "").trim();
  if (website && !looksLikeHttpUrl(website)) return json({ ok: false, error: "That website URL does not look right." }, 400);
  if (facebook && !looksLikeHttpUrl(facebook)) return json({ ok: false, error: "That social URL does not look right." }, 400);

  const payload = listingFromForm(form, slug);
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO submissions (id, kind, slug, payload, email, entity_type, official, status, created_at, updated_at)
       VALUES (?, 'add', ?, ?, ?, ?, 0, 'pending_email', ?, ?)`
    )
    .bind(id, slug, JSON.stringify(payload), email, entityType, nowIso(), nowIso())
    .run();

  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0 && env.GITHUB_TOKEN) {
    try {
      await stageListingPhoto(env, photo, slug, email);
    } catch (error) {
      console.error("listing photo stage failed", error);
    }
  }

  const code = await createCode(env, id, email);
  const mailed = await sendCode(env, email, {
    subject: `Confirm your Love Mallacoota listing: ${name}`,
    text: `Your confirmation code is ${code}. It expires in 15 minutes.\n\nEnter it at https://lovemallacoota.au/verify.html?id=${id}\n\nIf you did not request this, ignore the message.`,
    html: `<p>Your confirmation code is <strong>${code}</strong>. It expires in 15 minutes.</p><p><a href="https://lovemallacoota.au/verify.html?id=${id}">Enter the code</a></p>`,
  });
  if (!mailed) return json({ ok: false, error: "Could not send the code. Please try again." }, 502);

  await audit(env, "add-requested", { slug, submissionId: id, actor: email });
  return json({ ok: true, id, message: "We have emailed a code to the public address you gave." }, 200);
}

async function handleClaim(form: FormData, env: Env): Promise<Response> {
  const slug = slugify(String(form.get("slug") || ""));
  const email = String(form.get("email") || "").trim().toLowerCase();
  const listing = await findEntity(env, slug);
  if (!listing) return json({ ok: false, error: "We could not find that listing." }, 404);
  /*
   * An already-claimed listing still comes through here, because this is also
   * how its owner gets a fresh edit link — there are no accounts on this site,
   * only a link emailed to the address on the listing. canClaim() answers "may
   * a stranger claim this", which is a different question and would refuse the
   * owner. The email check below is the real guard either way: a code only ever
   * goes to the address already published.
   */
  const alreadyClaimed = Boolean(listing.verification?.email?.verifiedAt);
  if (isOfficialEntity(listing) || (!canClaim(listing) && !alreadyClaimed)) {
    return json({ ok: false, error: "Official listings cannot be claimed this way." }, 403);
  }
  if (!looksLikeEmail(email)) return json({ ok: false, error: "That email address does not look right." }, 400);

  const publishedEmail = String(listing.email || "").trim().toLowerCase();
  if (publishedEmail && publishedEmail !== email) {
    return json(
      {
        ok: false,
        error: "Use the email address already published on this listing. If that is no longer valid, suggest a correction.",
      },
      403
    );
  }

  const id = crypto.randomUUID();
  const needsReview = !publishedEmail;
  await requireReadyDb(env).prepare(
    `INSERT INTO submissions (id, kind, slug, payload, email, entity_type, official, status, created_at, updated_at)
     VALUES (?, 'claim', ?, ?, ?, ?, 0, ?, ?, ?)`
  )
    .bind(
      id,
      slug,
      JSON.stringify({ slug, name: listing.name }),
      email,
      listing.entityType,
      needsReview ? "pending_review" : "pending_email",
      nowIso(),
      nowIso()
    )
    .run();

  if (needsReview) {
    await sendMail(env, {
      subject: `Claim request: ${listing.name}`,
      text: `${email} wants to claim ${listing.name} (${slug}), which has no public email yet.`,
      html: `<p>${email} wants to claim <strong>${listing.name}</strong> (${slug}), which has no public email yet.</p>`,
    });
    await audit(env, "claim-held", { slug, submissionId: id, actor: email });
    return json(
      {
        ok: true,
        message: "This listing has no public email yet, so a person will check the claim. You will hear back by email.",
      },
      200
    );
  }

  const code = await createCode(env, id, email);
  const mailed = await sendCode(env, email, {
    subject: `Claim ${listing.name} on Love Mallacoota`,
    text: `Your confirmation code is ${code}. Enter it at https://lovemallacoota.au/verify.html?id=${id}`,
    html: `<p>Your confirmation code is <strong>${code}</strong>.</p><p><a href="https://lovemallacoota.au/verify.html?id=${id}">Enter the code</a></p>`,
  });
  if (!mailed) return json({ ok: false, error: "Could not send the code. Please try again." }, 502);
  await audit(env, "claim-requested", { slug, submissionId: id, actor: email });
  return json({ ok: true, id, message: "We have emailed a code to the address on the listing." }, 200);
}

async function handleEvent(form: FormData, env: Env): Promise<Response> {
  const title = plainText(String(form.get("title") || ""), 160);
  const description = plainText(String(form.get("description") || ""), 1200);
  const email = String(form.get("email") || "").trim().toLowerCase();
  const slug = slugify(String(form.get("slug") || ""));
  if (!title || !description || !looksLikeEmail(email)) {
    return json({ ok: false, error: "Event name, details and a real email are required." }, 400);
  }
  const token = String(form.get("token") || "");
  let trusted = false;
  if (token) {
    const hashed = await sha256Hex(token);
    const row = await requireReadyDb(env).prepare(
      `SELECT listing_slug FROM tokens WHERE token_hash = ? AND purpose = 'manage' AND revoked_at IS NULL AND expires_at > ?`
    )
      .bind(hashed, nowIso())
      .first<{ listing_slug: string }>();
    trusted = Boolean(row && (!slug || row.listing_slug === slug));
  }

  const id = crypto.randomUUID();
  const payload = {
    slug,
    title,
    description,
    starts: String(form.get("starts") || ""),
    ends: String(form.get("ends") || ""),
    where: plainText(String(form.get("where") || ""), 200),
    contactName: plainText(String(form.get("contactName") || ""), 120),
  };
  await requireReadyDb(env).prepare(
    `INSERT INTO submissions (id, kind, slug, payload, email, entity_type, official, status, created_at, updated_at)
     VALUES (?, 'event', ?, ?, ?, 'event', 0, ?, ?, ?)`
  )
    .bind(id, slug, JSON.stringify(payload), email, trusted ? "pending_review" : "pending_email", nowIso(), nowIso())
    .run();

  if (trusted) {
    await sendMail(env, {
      subject: `Event for review: ${title}`,
      text: `${title} from ${slug}\n${payload.starts} ${payload.where}\n${description}`,
      html: `<p><strong>${title}</strong> from ${slug}</p><p>${payload.starts} · ${payload.where}</p><p>${description}</p>`,
    });
    await audit(env, "event-submitted", { slug, submissionId: id, actor: email });
    return json({ ok: true, message: "Event sent for the calendar. You should see it once it has been added." }, 200);
  }

  const code = await createCode(env, id, email);
  const mailed = await sendCode(env, email, {
    subject: `Confirm your Mallacoota event: ${title}`,
    text: `Your confirmation code is ${code}. Enter it at https://lovemallacoota.au/verify.html?id=${id}`,
    html: `<p>Your confirmation code is <strong>${code}</strong>.</p><p><a href="https://lovemallacoota.au/verify.html?id=${id}">Enter the code</a></p>`,
  });
  if (!mailed) return json({ ok: false, error: "Could not send the code. Please try again." }, 502);
  return json({ ok: true, id, message: "We have emailed a code so we know this address is real." }, 200);
}

export async function handleListingVerify(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const db = requireDb(env);
  if (!db) return json({ ok: false, error: "The directory is not configured yet." }, 503);
  const form = await request.formData();
  const id = String(form.get("id") || "");
  const code = String(form.get("code") || "").replace(/\D/g, "");
  // Two different faults. A missing id is a broken link, not a mistyped code,
  // and telling somebody to check the six digits they just copied correctly
  // sends them round the same loop for as long as their patience lasts.
  if (!id) {
    console.error("verify called with no submission id — the link lost its ?id=");
    return json(
      { ok: false, error: "This link is missing its submission. Open the link in the email we sent you." },
      400
    );
  }
  if (code.length !== 6) return json({ ok: false, error: "Enter the six-digit code." }, 400);

  const submission = await db.prepare(`SELECT * FROM submissions WHERE id = ?`).bind(id).first<{
    id: string;
    kind: string;
    slug: string;
    payload: string;
    email: string;
    entity_type: string;
    official: number;
    status: string;
  }>();
  if (!submission) return json({ ok: false, error: "We could not find that submission." }, 404);

  const row = await db.prepare(
    `SELECT * FROM codes WHERE submission_id = ? AND used_at IS NULL ORDER BY expires_at DESC LIMIT 1`
  )
    .bind(id)
    .first<{ id: string; code_hash: string; salt: string; attempts: number; expires_at: string }>();
  if (!row) return json({ ok: false, error: "That code has expired. Submit again." }, 400);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: "That code has expired. Submit again." }, 400);
  }
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return json({ ok: false, error: "Too many attempts. Submit again." }, 429);
  }

  const hashed = await sha256Hex(`${row.salt}:${code}`);
  if (hashed !== row.code_hash) {
    await db.prepare(`UPDATE codes SET attempts = attempts + 1 WHERE id = ?`).bind(row.id).run();
    return json({ ok: false, error: "That code did not match." }, 403);
  }

  await db.prepare(`UPDATE codes SET used_at = ? WHERE id = ?`).bind(nowIso(), row.id).run();

  if (submission.kind === "event") {
    await db.prepare(`UPDATE submissions SET status = 'pending_review', updated_at = ? WHERE id = ?`)
      .bind(nowIso(), id)
      .run();
    const payload = JSON.parse(submission.payload) as { title?: string };
    await sendMail(env, {
      subject: `Event confirmed: ${payload.title || submission.slug}`,
      text: `Confirmed by ${submission.email}. Add it to the calendar when it is suitable.`,
      html: `<p>Confirmed by ${submission.email}. Add it to the calendar when it is suitable.</p>`,
    });
    return json({ ok: true, message: "Confirmed. The event will appear once it has been added to the calendar." }, 200);
  }

  if (submission.kind === "claim") {
    const token = await createManageToken(env, submission.slug, submission.email);
    await db.prepare(`UPDATE submissions SET status = 'approved', updated_at = ? WHERE id = ?`)
      .bind(nowIso(), id)
      .run();
    await audit(env, "claim-verified", { slug: submission.slug, submissionId: id, actor: submission.email });
    return json(
      {
        ok: true,
        manageUrl: `https://lovemallacoota.au/manage.html?token=${token}`,
        message: "This listing is yours to update.",
      },
      200
    );
  }

  if (submission.official) {
    await db.prepare(`UPDATE submissions SET status = 'pending_review', updated_at = ? WHERE id = ?`)
      .bind(nowIso(), id)
      .run();
    return json(
      { ok: true, message: "Email confirmed. An official listing still needs a person to publish it." },
      200
    );
  }

  const payload = JSON.parse(submission.payload) as Record<string, unknown>;
  const listing = payload as ReturnType<typeof listingFromForm>;
  listing.verification = {
    email: { value: submission.email, verifiedAt: melbourneDate(), method: "emailed-code" },
    lastReviewedAt: melbourneDate(),
  };
  listing.updatedAt = nowIso();

  try {
    await putGithubFile(
      env,
      `data/directory/${submission.slug}.json`,
      `${JSON.stringify(listing, null, 2)}\n`,
      `Add directory listing ${listing.name}`
    );
  } catch (error) {
    console.error("listing publish failed", error);
    await db.prepare(`UPDATE submissions SET status = 'pending_review', updated_at = ? WHERE id = ?`)
      .bind(nowIso(), id)
      .run();
    return json(
      {
        ok: true,
        message: "Email confirmed. Publishing is queued for a person — it will go live shortly.",
      },
      200
    );
  }

  const token = await createManageToken(env, submission.slug, submission.email);
  await db.prepare(`UPDATE submissions SET status = 'published', updated_at = ? WHERE id = ?`)
    .bind(nowIso(), id)
    .run();
  await audit(env, "listing-published", { slug: submission.slug, submissionId: id, actor: submission.email });
  return json(
    {
      ok: true,
      manageUrl: `https://lovemallacoota.au/manage.html?token=${token}`,
      message: "Email confirmed. The listing should be live in about two minutes.",
    },
    200
  );
}

export async function handleListingManage(request: Request, env: Env): Promise<Response> {
  const db = requireDb(env);
  if (!db) return json({ ok: false, error: "The directory is not configured yet." }, 503);
  const url = new URL(request.url);
  const token = request.method === "GET" ? url.searchParams.get("token") || "" : "";
  let form: FormData | null = null;
  if (request.method === "POST") {
    form = await request.formData();
  }
  const presented = token || String(form?.get("token") || "");
  if (!presented) return json({ ok: false, error: "Missing link." }, 401);

  const hashed = await sha256Hex(presented);
  const row = await db.prepare(
    `SELECT * FROM tokens WHERE token_hash = ? AND purpose = 'manage' AND revoked_at IS NULL`
  )
    .bind(hashed)
    .first<{ listing_slug: string; email: string; expires_at: string }>();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: "This link has expired. Claim the listing again to get a new one." }, 401);
  }

  const live = await findEntity(env, row.listing_slug);
  const latest = await db.prepare(
    `SELECT payload FROM submissions WHERE slug = ? AND status IN ('published', 'approved') ORDER BY updated_at DESC LIMIT 1`
  )
    .bind(row.listing_slug)
    .first<{ payload: string }>();
  const listing = latest?.payload ? { ...(live || {}), ...JSON.parse(latest.payload) } : live;
  if (request.method === "GET") {
    if (!listing) return json({ ok: false, error: "Listing not found." }, 404);
    return json(
      {
        ok: true,
        listing: {
          slug: listing.slug,
          entityType: listing.entityType,
          name: listing.name,
          description: listing.description,
          phone: listing.phone,
          email: listing.email,
          website: listing.website,
          social: listing.social,
          address: listing.address,
          serviceArea: listing.serviceArea,
          openingHours: listing.notes_seasonal || listing.openingHours,
          meetingTimes: listing.meetingTimes,
          accessibility: listing.accessibility,
          notes_seasonal: listing.notes_seasonal,
        },
      },
      200
    );
  }

  if (request.method !== "POST" || !form) return json({ ok: false, error: "Use POST." }, 405);
  if (isOfficialEntity(listing || { entityType: "government", official: true })) {
    return json({ ok: false, error: "Official listings cannot be edited this way." }, 403);
  }

  // The address the token was issued against — the one that received the code.
  const verifiedAddress = String(row.email || "").trim().toLowerCase();
  const nextEmail = String(form.get("email") || listing?.email || "").trim().toLowerCase() || null;

  // A listing could not change what it is. Entered once as a professional
  // service, it stayed one; the section it appears in follows the type, so it
  // was also stuck in the wrong part of the directory. An official type is not
  // reachable here — the guard above refuses to edit one at all, and neither
  // form offers it.
  const requestedType = String(form.get("entityType") || "");
  const nextType =
    (FORM_ENTITY_TYPES as readonly string[]).includes(requestedType) && !typeInfo(requestedType)?.official
      ? requestedType
      : listing?.entityType || "other";

  const updated = {
    ...(listing || {}),
    entityType: nextType,
    section: typeInfo(nextType)?.sectionHint || listing?.section || "community",
    name: plainText(String(form.get("name") || listing?.name || ""), 160),
    description: plainText(String(form.get("description") || listing?.description || ""), 1200),
    descriptionShort: plainText(String(form.get("description") || listing?.descriptionShort || ""), 220),
    phone: plainText(String(form.get("phone") || ""), 40) || null,
    email: nextEmail,
    website: looksLikeHttpUrl(String(form.get("website_url") || ""))
      ? String(form.get("website_url"))
      : listing?.website || null,
    social: looksLikeHttpUrl(String(form.get("facebook") || ""))
      ? [{ platform: "facebook", url: String(form.get("facebook")) }]
      : listing?.social || [],
    address: {
      ...(listing?.address || {}),
      street: plainText(String(form.get("street") || listing?.address?.street || ""), 160) || listing?.address?.street,
      locality: listing?.address?.locality || "Mallacoota",
      state: "VIC",
      postcode: "3892",
      country: "Australia",
    },
    serviceArea: plainText(String(form.get("serviceArea") || ""), 160) || listing?.serviceArea || null,
    meetingTimes: plainText(String(form.get("meetingTimes") || ""), 400) || null,
    accessibility: plainText(String(form.get("accessibility") || ""), 300) || null,
    notes_seasonal: plainText(String(form.get("statusNote") || form.get("openingHours") || ""), 400) || null,
    updatedAt: nowIso(),
    slug: row.listing_slug,
    verification: {
      ...(listing?.verification || {}),
      /*
       * Reaching this line required a manage token, and a manage token is only
       * issued after a code sent to the address published on the listing was
       * entered correctly. That is email verification — the strongest this site
       * has. It used to record only lastReviewedAt, so the one listing that had
       * actually proved control of its address still read "Not yet verified".
       *
       * If the owner changes the address in the same edit, the new one has not
       * been proved and is not claimed as verified.
       */
      email: verifiedAddress && nextEmail === verifiedAddress
        ? { value: verifiedAddress, verifiedAt: melbourneDate(), method: "emailed-code" }
        : { value: nextEmail, verifiedAt: null, method: "emailed-code" },
      lastReviewedAt: melbourneDate(),
    },
  };

  try {
    await putGithubFile(
      env,
      `data/directory/${row.listing_slug}.json`,
      `${JSON.stringify(updated, null, 2)}\n`,
      `Update directory listing ${updated.name}`
    );
  } catch (error) {
    console.error("listing update failed", error);
    return json({ ok: false, error: "Could not publish those changes just now." }, 502);
  }
  await audit(env, "listing-updated", { slug: row.listing_slug, actor: row.email });
  return json({ ok: true, message: "Saved. It should be on the site in about two minutes." }, 200);
}
