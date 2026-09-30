import { emailDomain, normalizeEmail, parseCsvList } from "./crypto";
import {
  DEFAULT_ADMIN_EMAILS,
  DEFAULT_ALLOWED_EMAILS,
  type EvaluatorAccessStatus,
} from "./config";

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
  const allowedEmails = unique([
    ...DEFAULT_ALLOWED_EMAILS,
    ...parseCsvList(env.RUNWAY_EVAL_ALLOWED_EMAILS),
  ]);
  const allowedDomains = parseCsvList(env.RUNWAY_EVAL_ALLOWED_DOMAINS);
  const adminEmails = unique([
    ...DEFAULT_ADMIN_EMAILS,
    ...parseCsvList(env.RUNWAY_EVAL_ADMIN_EMAILS),
  ]);
  return {
    enforce: evalEnforcedFromEnv(env),
    allowedEmails,
    allowedDomains,
    adminEmails,
    openRegistration: env.RUNWAY_EVAL_OPEN_REGISTRATION === "true",
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.toLowerCase()))];
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

export function canSkipOtp(input: {
  emailVerified: boolean;
  accessStatus: EvaluatorAccessStatus | null;
}): boolean {
  return input.emailVerified && input.accessStatus !== "revoked" && input.accessStatus !== null;
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
