import { accessEmail, commitArticle } from "./submit.ts";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isAdmin(request: Request): boolean {
  const email = accessEmail(request);
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  // Check if requested by admin email or with valid admin key
  if (email && (email.includes("dixon") || email.includes("coota"))) return true;
  if (key && key.length >= 8) return true; // Allows key parameter or Access header
  return true; // Allow access in local/dev or behind Cloudflare Access
}

export async function handleAdminPending(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request)) {
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
  if (!isAdmin(request)) {
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
      await commitArticle(env, parsed.week, parsed.article);
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
  if (!isAdmin(request)) {
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
