# Runway evaluation access

Flow (v0.91): public home → email → one-time code (always required) → name + Runway Evaluation Terms → Runway if approved, otherwise "Request received" until the admin approves.

Anyone can verify an email and accept the terms. Every acceptance is stored in `legal_acceptances` (name, email, IP, device, language, time zone, screen, referrer, terms version) and emailed to the admin(s) in `RUNWAY_EVAL_ADMIN_EMAILS` / `DEFAULT_ADMIN_EMAILS` (needs `RESEND_API_KEY`; without it the email is only logged).

Approval: open `/admin` (redirects to `/admin/evaluators`), click Approve next to the person, or add an email to pre-approve it. Pre-approved emails in `src/lib/eval/config.ts` (`DEFAULT_ALLOWED_EMAILS`) and `RUNWAY_EVAL_ALLOWED_EMAILS` stay approved automatically.

Public: `/` only (plus `/login` and the terms screens).
Protected: `/features`, `/resident`, `/valet`, `/manager`, and evaluation APIs.

## Environment

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Send sign-in and invite email |
| `RUNWAY_EVAL_FROM_EMAIL` | From address (`Runway <noreply@domain>`) |
| `RUNWAY_EVAL_SESSION_SECRET` | Signs evaluation session cookies (falls back to `BETTER_AUTH_SECRET`) |
| `RUNWAY_EVAL_ENFORCE` | `true`/`false`. Default follows `VITE_AUTH_ENABLED !== "false"` |
| `RUNWAY_EVAL_ALLOWED_EMAILS` | Optional comma-separated allowlist |
| `RUNWAY_EVAL_ALLOWED_DOMAINS` | Optional domain allowlist |
| `RUNWAY_EVAL_ADMIN_EMAILS` | Admin directory at `/admin/evaluators` |
| `RUNWAY_EVAL_OPEN_REGISTRATION` | `true` forces open verified-email access even if an allowlist exists |
| `RUNWAY_EVAL_DEV_ECHO` | `true` returns the OTP in the API response when email is only logged |
| `VITE_AUTH_ENABLED` | Existing Grok/Better Auth flag. `"false"` also turns eval enforcement off |
| `DATABASE_URL` | Neon/Postgres in production. PGLite is used when unset |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Existing Better Auth deploy secrets |

SHA-256 of `1.0`: `f2ade24dc5034fb57c388082843c3cc30937bcf9b54f82ba266a5e58c1d4c8a2`

Prior snapshot `legal/versions/2026-09-30-v1.md` is frozen and no longer required.

## Publish v2 of the terms

1. Copy the new agreement to `legal/versions/YYYY-MM-DD-v2.md`.
2. Do not edit `legal/versions/2026-09-30-v1.md`.
3. Replace `legal/RUNWAY_EVALUATION_TERMS.md` with the v2 text.
4. Change only `RUNWAY_EVALUATION_TERMS_VERSION` and `RUNWAY_EVALUATION_TERMS_EFFECTIVE_DATE` in `src/lib/eval/config.ts`.
5. Deploy. Prior `legal_acceptances` rows stay. Anyone with only v1 is shown the terms screen again.

## Invite / revoke

- Invite: `/admin/evaluators` or insert into `eval_invites` and set `evaluators.access_status = 'active'`.
- Revoke: `/admin/evaluators` or `update evaluators set access_status = 'revoked'`. Sessions are invalidated. Acceptance rows are not deleted.

## Review acceptances

`select * from legal_acceptances order by accepted_at desc;`

Also listed on `/admin/evaluators`.
