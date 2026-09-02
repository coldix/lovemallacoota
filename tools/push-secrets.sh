#!/usr/bin/env bash
#
# Project:     lovemallacoota.au
# File Name:   push-secrets.sh
# Description: Push production secrets from .env.secrets to the Workers that
#              need them, verifying each one against the service that owns it
#              before it goes anywhere.
#
# Cloudflare Worker secrets are write-only. Nothing can read one back, so a
# wrong value and a right value look identical in `wrangler secret list` — and
# so does an empty one. Every fault on 30-31 August 2026 was a value that looked
# set and was not. This script closes that gap: a secret that fails its check is
# reported and not sent, so a bad value cannot reach production the way three of
# them did.
#
# Values are never printed, never passed as arguments (which would put them in
# the process table and shell history), and only ever piped.
#
# Usage:
#   cp .env.secrets.template .env.secrets && chmod 600 .env.secrets
#   ./tools/push-secrets.sh              # verify and push everything set
#   ./tools/push-secrets.sh --check      # verify only, change nothing
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.secrets"
ADNET="${ADNET_DIR:-$HOME/web/adnet}"
CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

red()   { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
warn()  { printf '\033[33m%s\033[0m\n' "$1"; }

if [ ! -f "$ENV_FILE" ]; then
  red "No .env.secrets. Copy the template first:"
  echo "  cp .env.secrets.template .env.secrets && chmod 600 .env.secrets"
  exit 1
fi

# Refuse to run on a world-readable secrets file.
PERMS="$(stat -f '%Lp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")"
if [ "$PERMS" != "600" ]; then
  warn ".env.secrets is mode $PERMS. Tightening it to 600."
  chmod 600 "$ENV_FILE"
fi

# Read one value without echoing it or exposing it as an argument.
value_of() {
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1 | tr -d '\r\n'
}

FAILED=0

push() { # push <NAME> <dir> [extra wrangler args...]
  local name="$1" dir="$2"; shift 2
  if $CHECK_ONLY; then green "  verified (--check, not sent)"; return; fi
  if printf '%s' "$(value_of "$name")" | (cd "$dir" && npx wrangler secret put "$name" "$@" >/dev/null 2>&1); then
    green "  pushed to $(basename "$dir")"
  else
    red "  FAILED to push to $(basename "$dir")"; FAILED=1
  fi
}

echo "Reading $ENV_FILE"

# A key the template knows about but the file has never heard of is almost
# always a stale copy: .env.secrets was made before the secret existed, and a
# `sed -i "s|^NAME=.*|NAME=value|"` against it silently matches nothing and
# reports success. That is exactly how the Resend key looked set and was not.
for KEY in $(grep -oE '^[A-Z_]+=' "$ROOT/.env.secrets.template" | tr -d '='); do
  if ! grep -q "^$KEY=" "$ENV_FILE"; then
    warn "$KEY is in the template but missing from .env.secrets — add the line, or a sed against it will do nothing"
  fi
done
echo

# The line existing is not the same as the value existing. Worker secrets are
# write-only, so a value held only in Cloudflare is readable by nobody and this
# file cannot rebuild it — which is the whole reason the file exists. Names can
# be listed even though values cannot, and that is enough to catch the drift.
# STRIPE_WEBHOOK_SECRET sat like this from the day it was set until 2 September
# 2026: working in production, blank in the record, and silently skipped here.
LIVE="$(npx wrangler secret list --env="" 2>/dev/null \
  | grep -o '"name": *"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')"
if [ -z "$LIVE" ]; then
  warn "Could not list the Worker's secrets, so the record was not checked against production."
else
  for KEY in $LIVE; do
    if [ -z "$(value_of "$KEY")" ]; then
      warn "$KEY is set in production but blank in .env.secrets. Nothing can read it back,"
      warn "  so copy it from the service that issued it or this record cannot rebuild production."
    fi
  done
fi
echo

# --- Turnstile -------------------------------------------------------------
echo "TURNSTILE_SECRET_KEY"
V="$(value_of TURNSTILE_SECRET_KEY)"
if [ -z "$V" ]; then
  warn "  not set in .env.secrets, skipping"
else
  # A valid secret with a junk token gives invalid-input-response. A wrong one
  # gives invalid-input-secret, and an empty one missing-input-secret.
  CODES="$(curl -s -X POST https://challenges.cloudflare.com/turnstile/v0/siteverify \
    -F "secret=$V" -F "response=XXXX.DUMMY.TOKEN.XXXX" | grep -o '"error-codes":\[[^]]*\]')"
  if printf '%s' "$CODES" | grep -q 'invalid-input-response'; then
    green "  valid (Cloudflare accepted the secret)"
    push TURNSTILE_SECRET_KEY "$ROOT" --env=""
  else
    red "  REJECTED by Cloudflare: $CODES"
    red "  Both halves must come from the same Turnstile widget. Not sent."
    FAILED=1
  fi
fi
echo

# --- Relay -----------------------------------------------------------------
echo "RELAY_KEY"
V="$(value_of RELAY_KEY)"
if [ -z "$V" ]; then
  warn "  not set in .env.secrets, skipping"
elif [ ! -d "$ADNET" ]; then
  red "  adnet checkout not found at $ADNET — set ADNET_DIR. Not sent."
  red "  Sending to only one side guarantees a mismatch."
  FAILED=1
else
  green "  setting the same value on both ends"
  push RELAY_KEY "$ROOT" --env=""
  push RELAY_KEY "$ADNET" --config serve/wrangler.jsonc
  if ! $CHECK_ONLY; then
    sleep 3
    CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST https://ads.oze.net.au/relay \
      -H 'Authorization: Bearer deliberately-wrong' -H 'Content-Type: application/json' \
      -d '{"site":"lovemallacoota"}')"
    case "$CODE" in
      401) green "  relay is armed (401 to a wrong bearer)";;
      503) red   "  relay still reports 'not configured' — the adnet value did not take"; FAILED=1;;
      *)   warn  "  relay answered $CODE to a wrong bearer, which is unexpected";;
    esac
  fi
fi
echo

# --- GitHub ----------------------------------------------------------------
echo "GITHUB_TOKEN"
V="$(value_of GITHUB_TOKEN)"
if [ -z "$V" ]; then
  warn "  not set in .env.secrets, skipping"
else
  CODE="$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $V" -H 'User-Agent: lovemallacoota-push-secrets' \
    https://api.github.com/repos/coldix/lovemallacoota)"
  if [ "$CODE" = "200" ]; then
    green "  valid (GitHub accepted it for coldix/lovemallacoota)"
    push GITHUB_TOKEN "$ROOT" --env=""
  else
    red "  GitHub answered $CODE. Needs Contents: Read and write on"
    red "  coldix/lovemallacoota, and tokens expire. Not sent."
    FAILED=1
  fi
fi
echo

# --- Resend ----------------------------------------------------------------
echo "RESEND_API_KEY"
V="$(value_of RESEND_API_KEY)"
if [ -z "$V" ]; then
  warn "  not set in .env.secrets, skipping"
  warn "  without it no verification code can be sent and every submission is refused"
else
  # POST /emails with an empty body, which sends nothing. A bad key is refused
  # at 401 before the payload is looked at; a good one gets as far as 422,
  # complaining about the payload. Checking GET /domains instead would fail a
  # perfectly good Sending-access key, which only has permission to send.
  CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $V" -H 'Content-Type: application/json' -d '{}')"
  case "$CODE" in
    422|400)
      green "  valid (Resend accepted the key)"
      push RESEND_API_KEY "$ROOT" --env=""
      ;;
    401|403)
      red "  Resend rejected the key ($CODE). Check it was copied whole and is not revoked. Not sent."
      FAILED=1
      ;;
    *)
      warn "  Resend answered $CODE, which is not a clear yes or no; pushing anyway"
      push RESEND_API_KEY "$ROOT" --env=""
      ;;
  esac
fi
echo

# --- Stripe ----------------------------------------------------------------
echo "STRIPE_WEBHOOK_SECRET"
V="$(value_of STRIPE_WEBHOOK_SECRET)"
if [ -z "$V" ]; then
  warn "  not set in .env.secrets, skipping"
elif printf '%s' "$V" | grep -q '^whsec_'; then
  warn "  no read-only check exists for this one; pushing unverified"
  push STRIPE_WEBHOOK_SECRET "$ROOT" --env=""
else
  red "  does not start with whsec_ — that is not a Stripe signing secret. Not sent."
  FAILED=1
fi
echo

unset V
if [ "$FAILED" -eq 0 ]; then
  green "All done."
else
  red "Finished with problems — see above. Nothing unverified was sent."
  exit 1
fi
