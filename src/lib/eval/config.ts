/**
 * Single source of truth for the currently required Runway Evaluation Terms.
 * Do not scatter these values. To publish v2, add an immutable file under
 * legal/versions/ and then change ONLY the constants in this module.
 */
export const RUNWAY_EVALUATION_TERMS_NAME = "Runway Evaluation Terms";
export const RUNWAY_EVALUATION_TERMS_VERSION = "2026-09-30-v1";
export const RUNWAY_EVALUATION_TERMS_EFFECTIVE_DATE = "September 30, 2026";

export const EVAL_ACCEPTANCE_TEXT =
  "By selecting “Agree & Continue,” you agree to the Runway Evaluation Terms.";

export const EVAL_CHECKBOX_LABEL =
  "I have read and agree to the Runway Evaluation Terms.";

export const EVAL_SESSION_COOKIE = "runway_eval_session";
export const EVAL_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const EVAL_OTP_TTL_MS = 10 * 60 * 1000;
export const EVAL_OTP_MAX_ATTEMPTS = 5;
export const EVAL_OTP_MAX_PER_EMAIL_WINDOW = 5;
export const EVAL_OTP_WINDOW_MS = 15 * 60 * 1000;

export const DEFAULT_ALLOWED_EMAILS = [
  "alim@c3inspire.com",
  "gabriel.rojas@propark.com",
  "test@test.com",
  "joseph.mattesi@propark.com",
] as const;

export const DEFAULT_ADMIN_EMAILS = ["alim@c3inspire.com"] as const;

export type EvaluatorAccessStatus =
  | "pending"
  | "invited"
  | "active"
  | "revoked";
