# Runway evaluation access

Flow: Public marketing home → protected seat → email → one-time code (first visit only) → Runway Evaluation Terms → Runway.

Returning verified evaluators enter the same email and continue without a new code. If the required terms version has changed, they accept again.

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

SHA-256 of `2026-09-30-v1`: `da5e5941ef2e2d5304941a5f2486407707d5f2e79841142e1ef31ecaf6bec81f`

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
