/*
# Project:     lovemallacoota.au
# File Name:   submit.ts
# Description: POST /api/article — a contributor submits to this week's edition.
#              Identity comes from Cloudflare Access, which has already proved
#              the address; this only decides whether that address may publish,
#              whether the writing clears the editorial policy, and then commits
#              it. See docs/WEEKLY-MOUTH.md.
*/

import contributors from "../data/contributors.json" with { type: "json" };

const MAX = { title: 160, byline: 90, body: 12_000, email: 200, phone: 40, caption: 300 };
/** Bigger than any phone photograph, small enough to commit through the API. */
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Sections nobody can act on without a way to make contact. */
const NEEDS_CONTACT = new Set(["classifieds", "bdm", "positions"]);

export function needsContact(section: string): boolean {
  return NEEDS_CONTACT.has(section);
}
const OWNER = "coldix";
const REPO = "lovemallacoota";

interface Contributor {
  email: string;
  name: string;
  sections: string[];
  active: boolean;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Cloudflare Access has verified this; without it we are not behind Access. */
export function accessEmail(request: Request): string | null {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  return email && email.includes("@") ? email.toLowerCase() : null;
}

export function findContributor(email: string): Contributor | null {
  const found = (contributors as Contributor[]).find(
    (person) => person.email.toLowerCase() === email && person.active
  );
  return found ?? null;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Paragraphs, trimmed, with blank lines dropped. */
export function toParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n")
    )
    .filter(Boolean);
}

const POLICY = `You are checking a community newsletter submission for a small Australian coastal town against its published editorial policy.

The policy permits: events, notices, group updates, directory listings, school and sport information, local history, family notices, classifieds, and practical visitor information.

The policy explicitly ALLOWS advocacy and argument about the town's future — a swimming pool, better roads, footpaths, mobile coverage, how the council spends money, what should happen to a piece of land — including positions many people will disagree with, and including criticism of decisions made by councils, agencies and organisations. Disagreement, strong opinion and unpopular positions are all fine. Do not hold a submission merely because it is critical, political or controversial.

The policy refuses: personal attacks and pile-ons against a named individual; unverified allegations about named people or businesses; discriminatory material; anything placing someone at unreasonable risk, including a home address or a person's movements without their agreement; and anything presenting itself as an emergency authority.

Political articles are permitted, including from candidates and their supporters, provided they are truthful. Hold a political piece only if it asserts something as fact that reads as a serious factual claim about a named person or business without support, or if it is a personal attack. Do not hold it for being partisan, one-sided or unpopular.

Answer with JSON only: {"verdict":"pass"} if it may be published, or {"verdict":"hold","clause":"<the rule it offends>","reason":"<one sentence>"} if a human should look first. Be permissive. Hold only for a real breach of the list above.`;

export async function checkAgainstPolicy(
  env: Env,
  text: string
): Promise<{ verdict: "pass" | "hold" | "unchecked"; clause?: string; reason?: string }> {
  if (!env.AI) return { verdict: "unchecked", reason: "No policy check is configured." };
  try {
    const result = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: POLICY },
        { role: "user", content: text.slice(0, 8000) },
      ],
      max_tokens: 200,
    })) as { response?: string };

    const match = /\{[\s\S]*\}/.exec(result.response ?? "");
    if (!match) return { verdict: "hold", reason: "The policy check returned nothing readable." };
    const parsed = JSON.parse(match[0]) as { verdict?: string; clause?: string; reason?: string };
    return parsed.verdict === "pass"
      ? { verdict: "pass" }
      : { verdict: "hold", clause: parsed.clause, reason: parsed.reason };
  } catch (error) {
    console.error("policy check failed", error);
    // A check that cannot run must not wave things through.
    return { verdict: "hold", reason: "The policy check could not run." };
  }
}

export async function commitArticle(env: Env, week: string, article: Record<string, unknown>) {
  const path = `data/editions/${week}.json`;
  const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "lovemallacoota-worker",
  };

  const current = await fetch(api, { headers });
  if (!current.ok) throw new Error(`Cannot read ${path}: ${current.status}`);
  const file = (await current.json()) as { content: string; sha: string };
  const edition = JSON.parse(atob(file.content.replace(/\n/g, "")));

  if (edition.status !== "open") throw new Error("This week's edition is closed.");
  edition.articles = [...(edition.articles || []), article];

  const body = new TextEncoder().encode(`${JSON.stringify(edition, null, 2)}\n`);
  const written = await fetch(api, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Add "${article.title}" to ${week}`,
      content: btoa(String.fromCharCode(...body)),
      sha: file.sha,
    }),
  });
  if (!written.ok) throw new Error(`Cannot write ${path}: ${written.status}`);
}

async function putFile(env: Env, filePath: string, bytes: Uint8Array, message: string) {
  const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "lovemallacoota-worker",
    "Content-Type": "application/json",
  };

  // Chunked so a multi-megabyte photograph does not blow the call stack.
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }

  const response = await fetch(api, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message, content: btoa(binary) }),
  });
  if (!response.ok) throw new Error(`Cannot write ${filePath}: ${response.status}`);
}

/**
 * Staged into the repository rather than served from it: uploads/ is outside
 * the deploy allow-list, so an unconverted original never reaches the site.
 */
export async function stageImage(
  env: Env,
  file: File,
  meta: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const extension = IMAGE_TYPES[file.type];
  if (!extension) return { ok: false, error: "Photographs must be JPEG, PNG, WebP or HEIC." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "That photograph is over 12MB." };

  const stem = String(meta.articleId || `cover-${meta.week}`);
  const name = `${stem}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  await putFile(env, `uploads/${name}`, bytes, `Stage ${name} for conversion`);
  await putFile(
    env,
    `uploads/${stem}.json`,
    new TextEncoder().encode(`${JSON.stringify({ ...meta, file: name }, null, 2)}\n`),
    `Describe ${name}`
  );
  return { ok: true };
}

export async function handleArticleSubmit(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);

  const email = accessEmail(request);
  const contributor = email ? findContributor(email) : null;
  const isAuthedContributor = Boolean(contributor && contributor.active);

  const form = await request.formData();
  const week = String(form.get("week") || "").trim();
  const section = String(form.get("section") || "").trim();
  const title = String(form.get("title") || "").trim().slice(0, MAX.title);
  const byline = String(form.get("byline") || (contributor ? contributor.name : "")).trim().slice(0, MAX.byline);
  const raw = String(form.get("body") || "").trim().slice(0, MAX.body);
  const contactEmail = String(form.get("contact_email") || email || "").trim().slice(0, MAX.email);
  const contactPhone = String(form.get("contact_phone") || "").trim().slice(0, MAX.phone);
  const contactPublic = String(form.get("contact_public") || "") === "yes";

  if (!week || !section || !title || !raw) {
    return json({ ok: false, error: "Week, section, title and body are required." }, 400);
  }

  // If not signed in as a registered contributor, contact email and phone number are required
  if (!isAuthedContributor) {
    if (!contactEmail || !EMAIL_RE.test(contactEmail)) {
      return json({ ok: false, error: "Guest submissions require a valid contact email address." }, 400);
    }
    if (!contactPhone || contactPhone.length < 8) {
      return json({ ok: false, error: "Guest submissions require a contact phone number." }, 400);
    }
  } else if (contactEmail && !EMAIL_RE.test(contactEmail)) {
    return json({ ok: false, error: "That contact email does not look right." }, 400);
  }

  if (contributor && !contributor.sections.includes(section)) {
    return json({ ok: false, error: `You are not set up to post in ${section}.` }, 403);
  }

  // Classifieds & notices require contact details
  if (NEEDS_CONTACT.has(section)) {
    const hasContact =
      /\b(?:0\d[\d ]{7,}|\(0\d\)\s?\d{4}\s?\d{4})\b/.test(raw) ||
      EMAIL_RE.test(contactEmail) ||
      /[^\s@]+@[^\s@]+\.[^\s@]+/.test(raw) ||
      contactPhone.length >= 8;
    if (!hasContact) {
      return json(
        {
          ok: false,
          error:
            "A classified or family notice needs a phone number or an email address — either in the text, or in the contact fields with 'publish these details' ticked.",
        },
        400
      );
    }
  }

  const article = {
    id: `${week}-${section}-${slugify(title)}`,
    section,
    title,
    byline: byline || "Community Contributor",
    authorEmail: contactEmail || email || "guest",
    submittedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    check: { verdict: "pass", by: "policy check" },
    contact: {
      email: contactEmail || email || "",
      phone: contactPhone || null,
      public: contactPublic,
    },
    body: toParagraphs(raw),
  };

  // Up to 3 photographs
  const photoInputs = [
    { file: form.get("photo"), caption: String(form.get("caption") || "").trim().slice(0, MAX.caption), credit: String(form.get("credit") || "").trim().slice(0, MAX.caption), isCover: String(form.get("as_cover") || "") === "yes", suffix: "" },
    { file: form.get("photo2"), caption: String(form.get("caption2") || "").trim().slice(0, MAX.caption), credit: String(form.get("credit2") || "").trim().slice(0, MAX.caption), isCover: false, suffix: "-2" },
    { file: form.get("photo3"), caption: String(form.get("caption3") || "").trim().slice(0, MAX.caption), credit: String(form.get("credit3") || "").trim().slice(0, MAX.caption), isCover: false, suffix: "-3" },
  ];

  let photoNote = "";
  let stagedPhotosCount = 0;

  for (let i = 0; i < photoInputs.length; i++) {
    const item = photoInputs[i];
    if (item.file instanceof File && item.file.size > 0) {
      if (!item.credit) {
        photoNote += ` Photograph ${i + 1} needs a credit.`;
      } else {
        const staged = await stageImage(env, item.file, {
          kind: item.isCover ? "cover" : "article",
          week,
          articleId: item.isCover ? null : `${article.id}${item.suffix}`,
          caption: item.caption,
          credit: item.credit,
          alt: item.caption || article.title,
          submittedBy: contactEmail || email || "guest",
          rights: "review_required",
        });
        if (staged.ok) {
          stagedPhotosCount++;
        } else {
          photoNote += ` Photograph ${i + 1} error: ${staged.error}`;
        }
      }
    }
  }

  if (stagedPhotosCount > 0) {
    photoNote += ` ${stagedPhotosCount} photograph(s) attached.`;
  }

  const check = await checkAgainstPolicy(env, `${title}\n\n${raw}`);

  // Guest submissions OR policy query -> store in pending_approval
  if (!isAuthedContributor || check.verdict !== "pass") {
    if (env.DB) {
      const subId = `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      const payload = JSON.stringify({
        article,
        week,
        section,
        title,
        byline: article.byline,
        contactEmail: contactEmail || email,
        contactPhone,
        contactPublic,
        rawBody: raw,
        policyCheck: check,
        isGuest: !isAuthedContributor,
      });

      try {
        await env.DB.prepare(
          `INSERT INTO submissions (id, kind, slug, payload, email, entity_type, official, status, created_at, updated_at)
           VALUES (?, 'article', ?, ?, ?, ?, 0, 'pending_approval', ?, ?)`
        )
          .bind(subId, article.id, payload, contactEmail || email || "guest", section, now, now)
          .run();
      } catch (err) {
        console.error("Failed to store pending article submission in D1", err);
      }
    }

    return json(
      {
        ok: true,
        held: true,
        note: `Submitted — your piece has been placed in the review queue and will be published once approved by an admin.${photoNote}`,
      },
      202
    );
  }

  if (!env.GITHUB_TOKEN) {
    return json({ ok: false, error: "Publishing is not configured yet." }, 503);
  }

  try {
    await commitArticle(env, week, article);
  } catch (error) {
    console.error("commit failed", error);
    return json({ ok: false, error: (error as Error).message }, 502);
  }

  return json(
    { ok: true, id: article.id, note: `Published — live in about two minutes.${photoNote}` },
    200
  );
}
