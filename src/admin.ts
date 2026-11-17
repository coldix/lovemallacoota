import { accessEmail, commitArticle } from "./submit.ts";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Comma-separated emails from ADMIN_EMAILS, lowercased and trimmed. */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.includes("@"))
  );
}

function teamDomain(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return trimmed.includes(".") ? trimmed : null;
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function decodeJwtPart(value: string): Record<string, unknown> | null {
  const bytes = base64UrlToBytes(value);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const jwksCache = new Map<string, { expiresAt: number; keys: Map<string, CryptoKey> }>();

async function accessSigningKeys(team: string): Promise<Map<string, CryptoKey> | null> {
  const cached = jwksCache.get(team);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  try {
    const response = await fetch(`https://${team}/cdn-cgi/access/certs`);
    if (!response.ok) return null;
    const body = (await response.json()) as { keys?: JsonWebKey[] };
    const keys = new Map<string, CryptoKey>();
    for (const jwk of body.keys || []) {
      const kid = (jwk as JsonWebKey & { kid?: string }).kid;
      if (!kid || jwk.kty !== "RSA") continue;
      const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
      );
      keys.set(kid, key);
    }
    if (keys.size === 0) return null;
    jwksCache.set(team, { expiresAt: Date.now() + 60 * 60 * 1000, keys });
    return keys;
  } catch {
    return null;
  }
}

/**
 * Verify a Cloudflare Access JWT when the team domain and audience are
 * configured. Returns the email claim, or null if the token is missing or bad.
 */
export async function verifiedAccessEmail(
  request: Request,
  team: string,
  aud: string
): Promise<string | null> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJwtPart(headerPart);
  const payload = decodeJwtPart(payloadPart);
  const signature = base64UrlToBytes(signaturePart);
  if (!header || !payload || !signature) return null;
  if (header.alg !== "RS256") return null;
  const kid = typeof header.kid === "string" ? header.kid : "";
  if (!kid) return null;

  const keys = await accessSigningKeys(team);
  const key = keys?.get(kid);
  if (!key) return null;

  const data = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const signatureBuffer = new Uint8Array(signature);
  const ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, signatureBuffer, data);
  if (!ok) return null;

  if (payload.iss !== `https://${team}`) return null;
  const tokenAud = payload.aud;
  const audiences = Array.isArray(tokenAud) ? tokenAud : [tokenAud];
  if (!audiences.includes(aud)) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  return email.includes("@") ? email : null;
}

/**
 * Admin routes fail closed. A request is allowed only when:
 *   - ADMIN_EMAILS is set (comma-separated allow-list), and
 *   - Cloudflare Access has identified the caller as one of those addresses.
 *
 * If CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD are set, the Access JWT is
 * verified. Otherwise the Worker trusts Cf-Access-Authenticated-User-Email,
 * which is only safe when an Access application sits in front of /admin.html
 * and /api/admin/*. There is no query-string key and no default allow.
 */
export async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const allowed = parseAdminEmails(env.ADMIN_EMAILS);
  if (allowed.size === 0) return false;

  const team = teamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const aud = env.CF_ACCESS_AUD?.trim();
  if (team && aud) {
    const email = await verifiedAccessEmail(request, team, aud);
    return email != null && allowed.has(email);
  }

  const email = accessEmail(request);
  return email != null && allowed.has(email);
}

export async function handleAdminPending(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ ok: false, error: "Use GET." }, 405);
  }

  if (!(await isAdmin(request, env))) {
    return json({ ok: false, error: "Unauthorized access." }, 401);
  }

  if (!env.DB) {
    return json({ ok: true, submissions: [] }, 200);
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM submissions WHERE status IN ('pending_approval', 'pending_review', 'held') ORDER BY created_at DESC LIMIT 50`
    ).all<{
      id: string;
      kind: string;
      slug: string;
      payload: string;
      email: string;
      entity_type: string;
      status: string;
      created_at: string;
    }>();

    const items = (results || []).map((row) => {
      let parsed = {};
      try {
        parsed = JSON.parse(row.payload);
      } catch {
        parsed = {};
      }
      return {
        id: row.id,
        kind: row.kind,
        slug: row.slug,
        email: row.email,
        status: row.status,
        createdAt: row.created_at,
        data: parsed,
      };
    });

    return json({ ok: true, submissions: items }, 200);
  } catch (error) {
    console.error("Failed to query admin pending submissions", error);
    return json({ ok: false, error: (error as Error).message }, 500);
  }
}

export async function handleAdminApprove(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Use POST." }, 405);
  }

  if (!(await isAdmin(request, env))) {
    return json({ ok: false, error: "Unauthorized access." }, 401);
  }

  try {
    const body = (await request.json()) as { id: string };
    if (!body || !body.id) {
      return json({ ok: false, error: "Submission ID required." }, 400);
    }

    if (!env.DB) {
      return json({ ok: false, error: "Database not configured." }, 500);
    }

    const row = await env.DB.prepare(`SELECT * FROM submissions WHERE id = ?`).bind(body.id).first<{
      id: string;
      kind: string;
      slug: string;
      payload: string;
      status: string;
    }>();

    if (!row) {
      return json({ ok: false, error: "Submission not found." }, 404);
    }

    const parsed = JSON.parse(row.payload) as {
      article?: Record<string, unknown>;
      week?: string;
    };

    if (row.kind === "article" && parsed.article && parsed.week) {
      if (!env.GITHUB_TOKEN) {
        return json({ ok: false, error: "GitHub publishing not configured." }, 503);
      }
      const landed = await commitArticle(env, parsed.week, parsed.article);
      if (landed !== parsed.week) {
        parsed.week = landed;
        await env.DB.prepare(`UPDATE submissions SET payload = ? WHERE id = ?`).bind(JSON.stringify(parsed), body.id).run();
      }
    }

    const now = new Date().toISOString();
    await env.DB.prepare(`UPDATE submissions SET status = 'approved', updated_at = ? WHERE id = ?`)
      .bind(now, body.id)
      .run();

    return json({ ok: true, message: `Approved and published submission ${body.id}.` }, 200);
  } catch (error) {
    console.error("Approval error", error);
    return json({ ok: false, error: (error as Error).message }, 500);
  }
}

export async function handleAdminReject(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Use POST." }, 405);
  }

  if (!(await isAdmin(request, env))) {
    return json({ ok: false, error: "Unauthorized access." }, 401);
  }

  try {
    const body = (await request.json()) as { id: string };
    if (!body || !body.id) {
      return json({ ok: false, error: "Submission ID required." }, 400);
    }

    if (!env.DB) {
      return json({ ok: false, error: "Database not configured." }, 500);
    }

    const now = new Date().toISOString();
    await env.DB.prepare(`UPDATE submissions SET status = 'rejected', updated_at = ? WHERE id = ?`)
      .bind(now, body.id)
      .run();

    return json({ ok: true, message: `Rejected submission ${body.id}.` }, 200);
  } catch (error) {
    console.error("Rejection error", error);
    return json({ ok: false, error: (error as Error).message }, 500);
  }
}
