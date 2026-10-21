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
  accessStatus?: EvaluatorAccessStatus;
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
      input.accessStatus ??
      (row.access_status === "revoked"
        ? "revoked"
        : row.access_status === "active"
          ? "active"
          : initialAccessStatus({
              email,
              invited: Boolean(input.invited),
              policy,
            }));
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
  const status =
    input.accessStatus ??
    initialAccessStatus({
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

export async function createEvalSession(evaluatorId: string, method = "email"): Promise<string> {
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
  const people = await sql<{ email: string }>`
    select email from evaluators where id = ${evaluatorId} limit 1
  `;
  const email = people[0]?.email;
  if (email) {
    await sql`
      insert into eval_logins (id, evaluator_id, email, ip_address, user_agent, method)
      values (
        ${newId("login")},
        ${evaluatorId},
        ${email},
        ${meta.ip},
        ${meta.userAgent},
        ${method}
      )
    `;
  }
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
  let accessStatus = claims.accessStatus;
  try {
    const row = await findEvaluatorByEmail(claims.email);
    if (row) accessStatus = row.access_status;
  } catch (err) {
    console.error("[eval] could not refresh access status", err);
  }
  const acceptedCurrentTerms = cookieHasCurrentTerms(claims);
  return {
    enforced: true,
    authenticated: true,
    emailVerified: claims.verified,
    email: claims.email,
    name: null,
    organization: null,
    evaluatorId: claims.evaluatorId,
    userId: null,
    accessStatus,
    acceptedCurrentTerms,
    acceptedVersion: claims.acceptedVersion,
    acceptedAt: null,
    isAdmin: isAdminEmail(claims.email, policy),
    requiredVersion,
    canAccess: canAccessProtectedRunway({
      emailVerified: claims.verified,
      accessStatus,
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

export async function recordAcceptance(input: {
  name?: string | null;
  organization?: string | null;
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
  // Pending / invited evaluators may still record acceptance; they cannot access protected routes until approved.

  const claims = await readEvalCookie();
  if (!claims || claims.email !== status.email) {
    throw new EvalAccessError("Unauthorized", 401);
  }
  await writeEvalCookie({
    ...claims,
    acceptedVersion: RUNWAY_EVALUATION_TERMS_VERSION,
  });

  try {
    await ensureAgreementSeeded();
    const agreement = currentAgreement();
    const sql = await getSql();
    const seeded = await sql<{ sha256: string }>`
      select sha256 from evaluation_agreements where version = ${agreement.version} limit 1
    `;
    const hash = seeded[0]?.sha256 ?? agreement.sha256;
    const meta = requestMeta();
    const acceptedAt = new Date().toISOString();

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
        user_agent, acceptance_method, environment, account_status
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
        ${status.accessStatus}
      )
    `;
  } catch (err) {
    console.error("[eval] could not persist acceptance row", err);
  }
  return readEvalStatus();
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

export async function listLogins() {
  const sql = await getSql();
  return sql<{
    id: string;
    email: string;
    logged_in_at: string;
    ip_address: string | null;
    user_agent: string | null;
    method: string;
  }>`
    select id, email, logged_in_at, ip_address, user_agent, method
    from eval_logins
    order by logged_in_at desc
  `;
}

export const LEDGER_OWNER_EMAIL = "alim@c3inspire.com";

export async function listAcceptances() {
  const sql = await getSql();
  return sql<{
    id: string;
    email: string;
    name: string | null;
    organization: string | null;
    agreement_type: string;
    agreement_version: string;
    agreement_effective_date: string;
    agreement_hash: string;
    acceptance_text: string;
    accepted_at: string;
    ip_address: string | null;
    acceptance_method: string;
    environment: string | null;
    account_status: string | null;
  }>`
    select
      id, email, name, organization, agreement_type, agreement_version,
      agreement_effective_date, agreement_hash, acceptance_text, accepted_at,
      ip_address, acceptance_method, environment, account_status
    from legal_acceptances
    order by accepted_at desc
  `;
}

export async function submitEvalRequest(emailRaw: string): Promise<void> {
  const sql = await getSql();
  const email = normalizeEmail(emailRaw);
  const open = await sql<{ id: string }>`
    select id from demo_eval_requests
    where email = ${email} and status = 'pending'
    limit 1
  `;
  if (open[0]) return;
  const meta = requestMeta();
  await sql`
    insert into demo_eval_requests (id, email, status, ip_address, user_agent)
    values (${newId("req")}, ${email}, 'pending', ${meta.ip}, ${meta.userAgent})
  `;
}

export async function listEvalRequests() {
  const sql = await getSql();
  return sql<{
    id: string;
    email: string;
    status: string;
    requested_at: string;
    decided_at: string | null;
    decided_by: string | null;
  }>`
    select id, email, status, requested_at, decided_at, decided_by
    from demo_eval_requests
    order by requested_at desc
  `;
}

async function requireLedgerOwner(): Promise<string> {
  const status = await readEvalStatus();
  if (!status.email || normalizeEmail(status.email) !== LEDGER_OWNER_EMAIL) {
    throw new EvalAccessError("Forbidden", 403);
  }
  return status.email;
}

export async function decideEvalRequest(input: {
  id: string;
  decision: "approved" | "rejected";
}): Promise<void> {
  const decidedBy = await requireLedgerOwner();
  const sql = await getSql();
  const rows = await sql<{ id: string; email: string; status: string }>`
    select id, email, status from demo_eval_requests where id = ${input.id} limit 1
  `;
  const row = rows[0];
  if (!row || row.status !== "pending") {
    throw new EvalAccessError("That request is no longer pending.", 409);
  }
  await sql`
    update demo_eval_requests
    set status = ${input.decision}, decided_at = now(), decided_by = ${decidedBy}
    where id = ${row.id}
  `;
  if (input.decision === "approved") {
    await sql`
      update evaluators
      set access_status = 'active', updated_at = now()
      where email = ${row.email}
    `;
    return;
  }
  await sql`
    update evaluators
    set access_status = 'rejected', updated_at = now()
    where email = ${row.email}
  `;
  await sql`
    update eval_sessions
    set revoked_at = now()
    where revoked_at is null
      and evaluator_id in (select id from evaluators where email = ${row.email})
  `;
}

export async function endEvaluation(input: { email: string }): Promise<void> {
  const endedBy = await requireLedgerOwner();
  const email = normalizeEmail(input.email);
  if (email === LEDGER_OWNER_EMAIL) {
    throw new EvalAccessError("That evaluation cannot be ended.", 400);
  }
  const sql = await getSql();
  await sql`
    update evaluators
    set access_status = 'ended', updated_at = now()
    where email = ${email}
  `;
  await sql`
    update eval_sessions
    set revoked_at = now()
    where revoked_at is null
      and evaluator_id in (select id from evaluators where email = ${email})
  `;
  const ended = await sql<{ id: string }>`
    update demo_eval_requests
    set status = 'ended', decided_at = now(), decided_by = ${endedBy}
    where email = ${email} and status = 'approved'
    returning id
  `;
  if (!ended[0]) {
    const meta = requestMeta();
    await sql`
      insert into demo_eval_requests (id, email, status, decided_at, decided_by, ip_address, user_agent)
      values (
        ${newId("req")},
        ${email},
        'ended',
        now(),
        ${endedBy},
        ${meta.ip},
        ${meta.userAgent}
      )
    `;
  }
}
