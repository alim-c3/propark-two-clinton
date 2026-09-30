import { getSql } from "@/lib/db";
import { env } from "@/lib/env.server";
import {
  EVAL_OTP_MAX_ATTEMPTS,
  EVAL_OTP_MAX_PER_EMAIL_WINDOW,
  EVAL_OTP_TTL_MS,
  EVAL_OTP_WINDOW_MS,
} from "./config";
import { newId, normalizeEmail, randomOtpCode, sha256Hex } from "./crypto";
import { otpEmailCopy, sendEvalEmail } from "./email.server";
import { requestMeta, upsertEvaluator, createEvalSession, findEvaluatorByEmail, evaluatorHasCurrentTerms } from "./access.server";
import { canSkipOtp, emailOnAllowlist, initialAccessStatus, readEvalPolicy } from "./policy";
import { writeEvalCookie } from "./session-cookie.server";
import { RUNWAY_EVALUATION_TERMS_VERSION } from "./config";

export class EvalOtpError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "EvalOtpError";
    this.status = status;
  }
}

function otpPepper(): string {
  return env("RUNWAY_EVAL_SESSION_SECRET") ?? env("BETTER_AUTH_SECRET") ?? "runway-eval-otp";
}

function hashOtp(email: string, code: string): string {
  return sha256Hex(`${otpPepper()}:${normalizeEmail(email)}:${code}`);
}

export async function beginSignIn(emailRaw: string, _origin: string) {
  const email = normalizeEmail(emailRaw);
  const policy = readEvalPolicy();
  if (!policy.openRegistration && !emailOnAllowlist(email, policy)) {
    throw new EvalOtpError("This email is not on the evaluator list.", 403);
  }

  const accessStatus = initialAccessStatus({ email, invited: true, policy });
  let acceptedCurrentTerms = false;
  let evaluatorId = newId("eval");

  try {
    const existing = await findEvaluatorByEmail(email);
    if (existing?.access_status === "revoked") {
      throw new EvalOtpError("Evaluation access for this email has been revoked.", 403);
    }
    if (existing) {
      evaluatorId = existing.id;
      acceptedCurrentTerms = await evaluatorHasCurrentTerms(email);
      if (
        !canSkipOtp({
          emailVerified: existing.email_verified,
          accessStatus: existing.access_status,
        })
      ) {
        await upsertEvaluator({ email, invited: true, markVerified: true });
      }
      await createEvalSession(existing.id);
    } else {
      const evaluator = await upsertEvaluator({
        email,
        invited: true,
        markVerified: true,
      });
      evaluatorId = evaluator.id;
      await createEvalSession(evaluator.id);
    }
  } catch (err) {
    if (err instanceof EvalOtpError) throw err;
    console.error("[eval] database unavailable; continuing with signed session", err);
  }

  await writeEvalCookie({
    email,
    verified: true,
    accessStatus,
    acceptedVersion: acceptedCurrentTerms ? RUNWAY_EVALUATION_TERMS_VERSION : null,
    evaluatorId,
  });

  return {
    ok: true as const,
    method: "email" as const,
    email,
    accessStatus,
    acceptedCurrentTerms,
  };
}

export async function requestOtp(emailRaw: string, origin: string) {
  const email = normalizeEmail(emailRaw);
  const sql = await getSql();
  const since = new Date(Date.now() - EVAL_OTP_WINDOW_MS).toISOString();
  const recent = await sql<{ n: number }>`
    select count(*)::int as n
    from eval_otp_challenges
    where email = ${email} and created_at >= ${since}::timestamptz
  `;
  if ((recent[0]?.n ?? 0) >= EVAL_OTP_MAX_PER_EMAIL_WINDOW) {
    throw new EvalOtpError("Too many sign-in codes requested. Try again shortly.", 429);
  }

  const meta = requestMeta();
  const ip = meta.ip;
  if (ip) {
    const ipRecent = await sql<{ n: number }>`
      select count(*)::int as n
      from eval_otp_challenges
      where ip_address = ${ip} and created_at >= ${since}::timestamptz
    `;
    if ((ipRecent[0]?.n ?? 0) >= EVAL_OTP_MAX_PER_EMAIL_WINDOW * 2) {
      throw new EvalOtpError("Too many sign-in codes requested. Try again shortly.", 429);
    }
  }

  const code = randomOtpCode();
  const id = newId("otp");
  const expires = new Date(Date.now() + EVAL_OTP_TTL_MS).toISOString();
  await sql`
    insert into eval_otp_challenges (id, email, code_hash, expires_at, ip_address)
    values (${id}, ${email}, ${hashOtp(email, code)}, ${expires}::timestamptz, ${ip})
  `;
  await upsertEvaluator({ email });

  const verifyUrl = `${origin}/login?email=${encodeURIComponent(email)}`;
  const copy = otpEmailCopy({ email, code, verifyUrl });
  const sent = await sendEvalEmail({ to: email, ...copy });
  const echo =
    env("RUNWAY_EVAL_DEV_ECHO") === "true" && sent.provider === "log" ? code : undefined;
  return {
    ok: true as const,
    email,
    delivered: sent.delivered,
    provider: sent.provider,
    expiresInSeconds: EVAL_OTP_TTL_MS / 1000,
    devCode: echo,
  };
}

export async function verifyOtp(emailRaw: string, codeRaw: string) {
  const email = normalizeEmail(emailRaw);
  const code = codeRaw.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new EvalOtpError("Enter the 6-digit code from your email.");
  }
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    code_hash: string;
    expires_at: string;
    consumed_at: string | null;
    attempts: number;
  }>`
    select id, code_hash, expires_at, consumed_at, attempts
    from eval_otp_challenges
    where email = ${email}
    order by created_at desc
    limit 1
  `;
  const challenge = rows[0];
  if (!challenge) throw new EvalOtpError("No sign-in code found. Request a new code.");
  if (challenge.consumed_at) throw new EvalOtpError("That code was already used. Request a new code.");
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new EvalOtpError("That code has expired. Request a new code.");
  }
  if (challenge.attempts >= EVAL_OTP_MAX_ATTEMPTS) {
    throw new EvalOtpError("Too many attempts. Request a new code.", 429);
  }
  if (challenge.code_hash !== hashOtp(email, code)) {
    await sql`
      update eval_otp_challenges
      set attempts = attempts + 1
      where id = ${challenge.id}
    `;
    throw new EvalOtpError("That code is incorrect.");
  }

  const consumed = await sql<{ id: string }>`
    update eval_otp_challenges
    set consumed_at = now(), attempts = attempts + 1
    where id = ${challenge.id} and consumed_at is null
    returning id
  `;
  if (!consumed[0]) throw new EvalOtpError("That code was already used. Request a new code.");

  const evaluator = await upsertEvaluator({ email, markVerified: true });
  await createEvalSession(evaluator.id);
  return { ok: true as const, email, accessStatus: evaluator.access_status };
}
