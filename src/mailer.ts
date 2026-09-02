/*
# Project:     lovemallacoota.au
# File Name:   mailer.ts
# Description: Sending a verification code to somebody we have never met.
#
# This is deliberately separate from the adnet relay, which exists to send to
# one fixed address and refuses to be told a recipient — that is what makes a
# leaked relay key harmless. Verification codes are the opposite case: the whole
# point is to reach a stranger's inbox, at an address they typed a moment ago.
#
# The relay could not do this even if it were willing. It sends through
# Cloudflare Email Routing, which only delivers to addresses verified on the
# account, so a member of the public could never receive a code. Every code sent
# before this file existed went to coota@lovemallacoota.au instead of to the
# person waiting for it.
#
# Provider: Resend. One REST call, no SDK, no signing, and a free tier well
# above what this town will generate. Swapping it means rewriting `deliver`
# below and nothing else.
*/

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export interface MailResult {
  ok: boolean;
  /** Safe to log. Never contains the key or the recipient's message. */
  error?: string;
}

/**
 * True when this Worker can reach a stranger. Checked before anything is
 * written, so a submission is refused up front rather than stored in a state
 * that can never be completed.
 */
export function canSendToPeople(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
}

async function deliver(env: Env, mail: Mail): Promise<MailResult> {
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
  });

  if (response.ok) return { ok: true };

  // Resend explains refusals in the body — an unverified sending domain, a
  // malformed address, a key without permission. Worth having in the log,
  // because the person on the other end only ever sees "could not send".
  const detail = (await response.text().catch(() => "")).slice(0, 300);
  return { ok: false, error: `${response.status} ${detail}` };
}

/**
 * Send to a member of the public. Never falls back to the relay: the relay
 * would deliver the code to the site's own inbox, which looks like success and
 * leaves the person waiting for a message that will not arrive.
 */
export async function sendToPerson(env: Env, mail: Mail): Promise<MailResult> {
  if (!canSendToPeople(env)) {
    console.error("mailer is not configured - RESEND_API_KEY or MAIL_FROM is missing");
    return { ok: false, error: "not configured" };
  }

  try {
    const result = await deliver(env, mail);
    if (!result.ok) console.error("mailer refused the message", result.error);
    return result;
  } catch (error) {
    console.error("mailer threw", String(error).slice(0, 200));
    return { ok: false, error: "network" };
  }
}
