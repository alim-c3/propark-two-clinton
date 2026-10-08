import { SignJWT, jwtVerify } from "jose";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { env } from "@/lib/env.server";
import { currentAgreement } from "./agreement";
import {
  EVAL_ACCEPTANCE_TEXT,
  EVAL_SESSION_COOKIE,
  EVAL_SESSION_TTL_SECONDS,
  RUNWAY_EVALUATION_TERMS_VERSION,
  type EvaluatorAccessStatus,
} from "./config";
import { newId, normalizeEmail, sha256Hex } from "./crypto";
import { sendEvalEmail } from "./email.server";
import { blankEvalCookie, cookieHasCurrentTerms, readEvalCookie, writeEvalCookie } from "./session-cookie.server";
import {
  canAccessProtectedRunway,
  initialAccessStatus,
  isAdminEmail,
  readEvalPolicy,
} from "./policy";

export type EvalStatus = {
  enforced: boolean;
  authenticated: boolean;
  emailVerified: boolean;
  email: string | null;
  name: string | null;
  organization: string | null;
  evaluatorId: string | null;
  userId: string | null;
  accessStatus: EvaluatorAccessStatus | null;
  acceptedCurrentTerms: boolean;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  isAdmin: boolean;
  requiredVersion: string;
  canAccess: boolean;
};

export class EvalAccessError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "EvalAccessError";
    this.status = status;
  }
}

function sessionSecret(): Uint8Array {
  const raw =
    env("RUNWAY_EVAL_SESSION_SECRET") ??
    env("BETTER_AUTH_SECRET") ??
    "runway-eval-dev-secret-change-me";
  return new TextEncoder().encode(raw);
}

export function requestMeta(): { ip: string | null; userAgent: string | null } {
  const request = getRequest();
  if (!request) return { ip: null, userAgent: null };
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  return { ip, userAgent: request.headers.get("user-agent") };
}

export function currentEnvironment(): string {
  return env("VERCEL_ENV") ?? env("NODE_ENV") ?? "development";
}

type EvaluatorRow = {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  organization: string | null;
  email_verified: boolean;
  access_status: EvaluatorAccessStatus;
};

export async function ensureAgreementSeeded(): Promise<void> {
  const sql = await getSql();
  const agreement = currentAgreement();
  await sql`
    insert into evaluation_agreements (version, name, effective_date, sha256, body)
    values (
      ${agreement.version},
      ${agreement.name},
      ${agreement.effectiveDate},
      ${agreement.sha256},
      ${agreement.body}
    )
    on conflict (version) do nothing
  `;
}

export async function upsertEvaluator(input: {
  email: string;
  name?: string | null;
  organization?: string | null;
  invited?: boolean;
  markVerified?: boolean;
}): Promise<EvaluatorRow> {
  const sql = await getSql();
  const policy = readEvalPolicy();
  const email = normalizeEmail(input.email);
  const existing = await sql<EvaluatorRow>`
    select id, user_id, email, name, organization, email_verified, access_status
    from evaluators
    where email = ${email}
    limit 1
  `;
  const now = new Date().toISOString();
  if (existing[0]) {
    const row = existing[0];
    const nextStatus =
      row.access_status === "revoked" && !input.invited
        ? "revoked"
        : row.access_status === "active"
          ? "active"
          : initialAccessStatus({
              email,
              invited: Boolean(input.invited),
              policy,
            });
    const verified = row.email_verified || Boolean(input.markVerified);
    await sql`
      update evaluators
      set
        name = coalesce(${input.name ?? null}, name),
        organization = coalesce(${input.organization ?? null}, organization),
        email_verified = ${verified},
        email_verified_at = case
          when ${verified} and email_verified_at is null then ${now}::timestamptz
          else email_verified_at
        end,
        access_status = ${nextStatus},
        updated_at = ${now}::timestamptz
      where id = ${row.id}
    `;
    return {
      ...row,
      name: input.name ?? row.name,
      organization: input.organization ?? row.organization,
      email_verified: verified,
      access_status: nextStatus,
    };
  }

  const id = newId("eval");
  const status = initialAccessStatus({
    email,
    invited: Boolean(input.invited),
    policy,
  });
  const verified = Boolean(input.markVerified);
  await sql`
    insert into evaluators (
      id, email, name, organization, email_verified, email_verified_at, access_status
    ) values (
      ${id},
      ${email},
      ${input.name ?? null},
      ${input.organization ?? null},
      ${verified},
      ${verified ? now : null},
      ${status}
    )
  `;
  return {
    id,
    user_id: null,
    email,
    name: input.name ?? null,
    organization: input.organization ?? null,
    email_verified: verified,
    access_status: status,
  };
}

export async function findEvaluatorByEmail(emailRaw: string): Promise<EvaluatorRow | null> {
  const sql = await getSql();
  const email = normalizeEmail(emailRaw);
  const rows = await sql<EvaluatorRow>`
    select id, user_id, email, name, organization, email_verified, access_status
    from evaluators
    where email = ${email}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function evaluatorHasCurrentTerms(email: string): Promise<boolean> {
  const acceptance = await latestAcceptance(email, RUNWAY_EVALUATION_TERMS_VERSION);
  return Boolean(acceptance);
}

export async function createEvalSession(evaluatorId: string): Promise<string> {
  const sql = await getSql();
  const sessionId = newId("sess");
  const raw = newId("tok");
  const tokenHash = sha256Hex(raw);
  const expires = new Date(Date.now() + EVAL_SESSION_TTL_SECONDS * 1000).toISOString();
  const meta = requestMeta();
  await sql`
    insert into eval_sessions (
      id, evaluator_id, token_hash, expires_at, ip_address, user_agent
    ) values (
      ${sessionId},
      ${evaluatorId},
      ${tokenHash},
      ${expires}::timestamptz,
      ${meta.ip},
      ${meta.userAgent}
    )
  `;
  await sql`
    update evaluators
    set last_login_at = now(), updated_at = now()
    where id = ${evaluatorId}
  `;
  const jwt = await new SignJWT({ sid: sessionId, eid: evaluatorId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(evaluatorId)
    .setIssuedAt()
    .setExpirationTime(`${EVAL_SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret());
  setCookie(EVAL_SESSION_COOKIE, jwt, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: EVAL_SESSION_TTL_SECONDS,
  });
  return jwt;
}

export async function clearEvalSession(): Promise<void> {
  blankEvalCookie();
}

export async function readSessionEvaluator(): Promise<EvaluatorRow | null> {
  const token = getCookie(EVAL_SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    const sid = typeof payload.sid === "string" ? payload.sid : null;
    const eid = typeof payload.eid === "string" ? payload.eid : null;
    if (!sid || !eid) return null;
    const sql = await getSql();
    const rows = await sql<EvaluatorRow & { revoked_at: string | null; expires_at: string }>`
      select
        e.id, e.user_id, e.email, e.name, e.organization, e.email_verified, e.access_status,
        s.revoked_at, s.expires_at
      from eval_sessions s
      join evaluators e on e.id = s.evaluator_id
      where s.id = ${sid} and e.id = ${eid}
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    if (row.revoked_at) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    return row;
  } catch {
    return null;
  }
}

async function latestAcceptance(email: string, version: string) {
  const sql = await getSql();
  const rows = await sql<{
    agreement_version: string;
    accepted_at: string;
  }>`
    select agreement_version, accepted_at
    from legal_acceptances
    where email = ${normalizeEmail(email)}
      and agreement_version = ${version}
    order by accepted_at desc
    limit 1
  `;
  return rows[0] ?? null;
}

export async function readEvalStatus(): Promise<EvalStatus> {
  const policy = readEvalPolicy();
  const requiredVersion = RUNWAY_EVALUATION_TERMS_VERSION;
  const empty: EvalStatus = {
    enforced: policy.enforce,
    authenticated: false,
    emailVerified: false,
    email: null,
    name: null,
    organization: null,
    evaluatorId: null,
    userId: null,
    accessStatus: null,
    acceptedCurrentTerms: false,
    acceptedVersion: null,
    acceptedAt: null,
    isAdmin: false,
    requiredVersion,
    canAccess: false,
  };
  if (!policy.enforce) {
    return { ...empty, canAccess: true };
  }

  const claims = await readEvalCookie();
  if (!claims) return empty;
  const acceptedCurrentTerms = cookieHasCurrentTerms(claims);
  // The cookie only remembers the status at sign-in. Approvals and revocations
  // happen later, so read the live status; fall back to the cookie if the
  // database is unreachable.
  let liveStatus: EvaluatorAccessStatus = claims.accessStatus;
  let liveName: string | null = null;
  try {
    const live = await findEvaluatorByEmail(claims.email);
    if (live) {
      liveStatus = live.access_status;
      liveName = live.name;
    }
  } catch (err) {
    console.error("[eval] could not read live access status", err);
  }
  return {
    enforced: true,
    authenticated: true,
    emailVerified: claims.verified,
    email: claims.email,
    name: liveName,
    organization: null,
    evaluatorId: claims.evaluatorId,
    userId: null,
    accessStatus: liveStatus,
    acceptedCurrentTerms,
    acceptedVersion: claims.acceptedVersion,
    acceptedAt: null,
    isAdmin: isAdminEmail(claims.email, policy),
    requiredVersion,
    canAccess: canAccessProtectedRunway({
      emailVerified: claims.verified,
      accessStatus: liveStatus,
      acceptedCurrentTerms,
    }),
  };
}

export async function assertProtectedEvalAccess(): Promise<EvalStatus> {
  const status = await readEvalStatus();
  if (!status.enforced) return status;
  if (!status.authenticated || !status.emailVerified) {
    throw new EvalAccessError("Unauthorized", 401);
  }
  if (status.accessStatus === "revoked") {
    throw new EvalAccessError("Evaluation access revoked", 403);
  }
  if (status.accessStatus !== "active") {
    throw new EvalAccessError("Evaluation access is not active", 403);
  }
  if (!status.acceptedCurrentTerms) {
    throw new EvalAccessError("Current evaluation terms have not been accepted", 403);
  }
  return status;
}

export type AcceptanceContext = {
  timeZone?: string | null;
  language?: string | null;
  screen?: string | null;
  referrer?: string | null;
};

function clip(value: string | null | undefined, max = 300): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function recordAcceptance(input: {
  name?: string | null;
  organization?: string | null;
  context?: AcceptanceContext;
}): Promise<EvalStatus> {
  const status = await readEvalStatus();
  if (!status.authenticated || !status.evaluatorId || !status.email) {
    throw new EvalAccessError("Unauthorized", 401);
  }
  if (!status.emailVerified) {
    throw new EvalAccessError("Email is not verified", 403);
  }
  if (status.accessStatus === "revoked") {
    throw new EvalAccessError("Evaluation access revoked", 403);
  }
  // Anyone with a verified email may accept the terms. Whether they get in is
  // decided separately by the admin (pending -> active).

  const claims = await readEvalCookie();
  if (!claims || claims.email !== status.email) {
    throw new EvalAccessError("Unauthorized", 401);
  }
  await writeEvalCookie({
    ...claims,
    acceptedVersion: RUNWAY_EVALUATION_TERMS_VERSION,
  });

  const meta = requestMeta();
  const acceptedAt = new Date().toISOString();
  const acceptHeaders = getRequest()?.headers;
  const context = {
    language: clip(input.context?.language) ?? clip(acceptHeaders?.get("accept-language")),
    referrer: clip(input.context?.referrer, 500),
    timeZone: clip(input.context?.timeZone, 80),
    screen: clip(input.context?.screen, 40),
  };
  const agreement = currentAgreement();
  const displayName = clip(input.name) ?? status.name;

  try {
    await ensureAgreementSeeded();
    const sql = await getSql();
    const seeded = await sql<{ sha256: string }>`
      select sha256 from evaluation_agreements where version = ${agreement.version} limit 1
    `;
    const hash = seeded[0]?.sha256 ?? agreement.sha256;

    if (input.name || input.organization) {
      await sql`
        update evaluators
        set
          name = coalesce(${input.name ?? null}, name),
          organization = coalesce(${input.organization ?? null}, organization),
          updated_at = now()
        where id = ${status.evaluatorId}
      `;
    }

    await sql`
      insert into legal_acceptances (
        id, user_id, evaluator_id, email, name, organization,
        agreement_type, agreement_version, agreement_effective_date,
        agreement_hash, acceptance_text, accepted_at, ip_address,
        user_agent, acceptance_method, environment, account_status,
        accept_language, referrer, time_zone, screen
      ) values (
        ${newId("acc")},
        ${status.userId},
        ${status.evaluatorId},
        ${status.email},
        ${input.name ?? status.name},
        ${input.organization ?? status.organization},
        ${agreement.name},
        ${agreement.version},
        ${agreement.effectiveDate},
        ${hash},
        ${EVAL_ACCEPTANCE_TEXT},
        ${acceptedAt}::timestamptz,
        ${meta.ip},
        ${meta.userAgent},
        ${"clickwrap"},
        ${currentEnvironment()},
        ${status.accessStatus},
        ${context.language},
        ${context.referrer},
        ${context.timeZone},
        ${context.screen}
      )
    `;
  } catch (err) {
    console.error("[eval] could not persist acceptance row", err);
  }

  await notifyAdminOfAcceptance({
    email: status.email,
    name: displayName,
    organization: input.organization ?? status.organization,
    accessStatus: status.accessStatus ?? "pending",
    agreementName: agreement.name,
    agreementVersion: agreement.version,
    acceptedAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
    ...context,
  });
  // The cookie written above is not visible to this request yet, so report the
  // post-acceptance state explicitly instead of re-reading the stale cookie.
  const fresh = await readEvalStatus();
  return {
    ...fresh,
    acceptedCurrentTerms: true,
    acceptedVersion: RUNWAY_EVALUATION_TERMS_VERSION,
    canAccess: canAccessProtectedRunway({
      emailVerified: fresh.emailVerified,
      accessStatus: fresh.accessStatus ?? "pending",
      acceptedCurrentTerms: true,
    }),
  };
}

function requestOriginFromHeaders(): string {
  const headers = getRequest()?.headers;
  const host = headers?.get("x-forwarded-host") ?? headers?.get("host");
  if (!host) return "https://garagerunway.com";
  return `${headers?.get("x-forwarded-proto") ?? "https"}://${host}`;
}

/**
 * Emails the admin(s) one message per acceptance. A mail failure must never
 * undo the acceptance, so it is only logged.
 */
async function notifyAdminOfAcceptance(info: {
  email: string;
  name: string | null;
  organization: string | null;
  accessStatus: EvaluatorAccessStatus;
  agreementName: string;
  agreementVersion: string;
  acceptedAt: string;
  ip: string | null;
  userAgent: string | null;
  language: string | null;
  referrer: string | null;
  timeZone: string | null;
  screen: string | null;
}): Promise<void> {
  try {
    const policy = readEvalPolicy();
    const adminUrl = `${requestOriginFromHeaders()}/admin`;
    const needsApproval = info.accessStatus !== "active";
    const line = (label: string, value: string | null) => `${label}: ${value ?? "unknown"}`;
    const text = [
      needsApproval
        ? "Someone accepted the Runway terms and is waiting for your approval."
        : "An approved user accepted the Runway terms.",
      "",
      line("Name", info.name),
      line("Email (verified by code)", info.email),
      line("Organization", info.organization),
      line("Status", info.accessStatus),
      "",
      line("Terms", `${info.agreementName} v${info.agreementVersion}`),
      line("Accepted at (UTC)", info.acceptedAt),
      line("Time zone", info.timeZone),
      line("IP address", info.ip),
      line("Device / browser", info.userAgent),
      line("Language", info.language),
      line("Screen", info.screen),
      line("Came from", info.referrer),
      "",
      needsApproval ? `Approve or review: ${adminUrl}` : `Admin: ${adminUrl}`,
    ].join("\n");
    const subject = `${needsApproval ? "Approval needed" : "Terms accepted"}: ${
      info.name ?? info.email
    } (${info.email})`;
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    for (const to of policy.adminEmails) {
      await sendEvalEmail({
        to,
        subject,
        text,
        html: `<pre style="font:14px/1.5 monospace">${escaped}</pre>`,
      });
    }
  } catch (err) {
    console.error("[eval] could not email admin about acceptance", err);
  }
}

export async function revokeEvaluator(email: string): Promise<void> {
  const sql = await getSql();
  const normalized = normalizeEmail(email);
  await sql`
    update evaluators
    set access_status = 'revoked', updated_at = now()
    where email = ${normalized}
  `;
  await sql`
    update eval_sessions
    set revoked_at = now()
    where revoked_at is null
      and evaluator_id in (select id from evaluators where email = ${normalized})
  `;
}

export async function inviteEvaluator(input: {
  email: string;
  invitedBy: string;
}): Promise<void> {
  const sql = await getSql();
  const email = normalizeEmail(input.email);
  await sql`
    insert into eval_invites (id, email, invited_by)
    values (${newId("inv")}, ${email}, ${input.invitedBy})
  `;
  await upsertEvaluator({ email, invited: true });
}

export async function listEvaluators() {
  const sql = await getSql();
  return sql<{
    id: string;
    email: string;
    name: string | null;
    organization: string | null;
    email_verified: boolean;
    access_status: EvaluatorAccessStatus;
    created_at: string;
    last_login_at: string | null;
    accepted_version: string | null;
    accepted_at: string | null;
  }>`
    select
      e.id,
      e.email,
      e.name,
      e.organization,
      e.email_verified,
      e.access_status,
      e.created_at,
      e.last_login_at,
      a.agreement_version as accepted_version,
      a.accepted_at
    from evaluators e
    left join lateral (
      select agreement_version, accepted_at
      from legal_acceptances
      where evaluator_id = e.id
      order by accepted_at desc
      limit 1
    ) a on true
    order by e.created_at desc
  `;
}

export async function listAcceptances() {
  const sql = await getSql();
  return sql`
    select
      id, email, name, organization, agreement_type, agreement_version,
      agreement_effective_date, agreement_hash, acceptance_text, accepted_at,
      ip_address, user_agent, accept_language, referrer, time_zone, screen,
      acceptance_method, environment, account_status
    from legal_acceptances
    order by accepted_at desc
  `;
}
