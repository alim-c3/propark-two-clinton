import { emailDomain, normalizeEmail, parseCsvList } from "./crypto";
import type { EvaluatorAccessStatus } from "./config";

export type EvalPolicy = {
  enforce: boolean;
  allowedEmails: string[];
  allowedDomains: string[];
  adminEmails: string[];
  openRegistration: boolean;
};

export function evalEnforcedFromEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.RUNWAY_EVAL_ENFORCE === "false") return false;
  if (env.RUNWAY_EVAL_ENFORCE === "true") return true;
  return env.VITE_AUTH_ENABLED !== "false";
}

export function readEvalPolicy(
  env: Record<string, string | undefined> = process.env,
): EvalPolicy {
  const allowedEmails = parseCsvList(env.RUNWAY_EVAL_ALLOWED_EMAILS);
  const allowedDomains = parseCsvList(env.RUNWAY_EVAL_ALLOWED_DOMAINS);
  const adminEmails = parseCsvList(env.RUNWAY_EVAL_ADMIN_EMAILS);
  const allowlistConfigured = allowedEmails.length > 0 || allowedDomains.length > 0;
  const openRegistration =
    env.RUNWAY_EVAL_OPEN_REGISTRATION === "true" || !allowlistConfigured;
  return {
    enforce: evalEnforcedFromEnv(env),
    allowedEmails,
    allowedDomains,
    adminEmails,
    openRegistration,
  };
}

export function emailOnAllowlist(email: string, policy: EvalPolicy): boolean {
  const normalized = normalizeEmail(email);
  if (policy.adminEmails.includes(normalized)) return true;
  if (policy.allowedEmails.includes(normalized)) return true;
  const domain = emailDomain(normalized);
  return Boolean(domain && policy.allowedDomains.includes(domain));
}

export function isAdminEmail(email: string, policy: EvalPolicy): boolean {
  return policy.adminEmails.includes(normalizeEmail(email));
}

export function initialAccessStatus(input: {
  email: string;
  invited: boolean;
  policy: EvalPolicy;
}): EvaluatorAccessStatus {
  if (isAdminEmail(input.email, input.policy) || input.invited) return "active";
  if (input.policy.openRegistration) return "active";
  if (emailOnAllowlist(input.email, input.policy)) return "active";
  return "pending";
}

export function hasCurrentAcceptance(input: {
  acceptedVersion: string | null;
  requiredVersion: string;
}): boolean {
  return input.acceptedVersion === input.requiredVersion;
}

export function canAccessProtectedRunway(input: {
  emailVerified: boolean;
  accessStatus: EvaluatorAccessStatus;
  acceptedCurrentTerms: boolean;
}): boolean {
  return (
    input.emailVerified &&
    input.accessStatus === "active" &&
    input.acceptedCurrentTerms
  );
}
