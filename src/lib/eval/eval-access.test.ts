import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  canAccessProtectedRunway,
  emailOnAllowlist,
  evalEnforcedFromEnv,
  hasCurrentAcceptance,
  initialAccessStatus,
  isAdminEmail,
  readEvalPolicy,
} from "./policy.ts";
import { isValidEmail, normalizeEmail, sha256Hex } from "./crypto.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("canonical agreement files are identical and hash-stable", () => {
  const live = readFileSync(join(root, "legal/RUNWAY_EVALUATION_TERMS.md"), "utf8");
  const frozen = readFileSync(join(root, "legal/versions/2026-09-30-v1.md"), "utf8");
  assert.equal(live, frozen);
  assert.match(live, /RUNWAY EVALUATION TERMS/);
  assert.match(live, /\*\*Version:\*\* 2026-09-30-v1/);
  assert.match(live, /## 28\. Electronic Acceptance/);
  assert.equal(sha256Hex(live), createHash("sha256").update(live, "utf8").digest("hex"));
});

test("checkbox is not implied by policy helpers", () => {
  assert.equal(
    canAccessProtectedRunway({
      emailVerified: true,
      accessStatus: "active",
      acceptedCurrentTerms: false,
    }),
    false,
  );
});

test("unverified email cannot access protected Runway", () => {
  assert.equal(
    canAccessProtectedRunway({
      emailVerified: false,
      accessStatus: "active",
      acceptedCurrentTerms: true,
    }),
    false,
  );
});

test("revoked evaluator cannot access Runway", () => {
  assert.equal(
    canAccessProtectedRunway({
      emailVerified: true,
      accessStatus: "revoked",
      acceptedCurrentTerms: true,
    }),
    false,
  );
});

test("returning evaluator with current acceptance can access", () => {
  assert.equal(
    canAccessProtectedRunway({
      emailVerified: true,
      accessStatus: "active",
      acceptedCurrentTerms: true,
    }),
    true,
  );
});

test("new required version invalidates prior acceptance only for access", () => {
  assert.equal(
    hasCurrentAcceptance({
      acceptedVersion: "2026-09-30-v1",
      requiredVersion: "2026-09-30-v1",
    }),
    true,
  );
  assert.equal(
    hasCurrentAcceptance({
      acceptedVersion: "2026-09-30-v1",
      requiredVersion: "2026-11-01-v2",
    }),
    false,
  );
});

test("each evaluator is authorized individually", () => {
  const policy = readEvalPolicy({
    RUNWAY_EVAL_ALLOWED_EMAILS: "gabe@operator.com",
  });
  assert.equal(emailOnAllowlist("gabe@operator.com", policy), true);
  assert.equal(emailOnAllowlist("other@operator.com", policy), false);
  assert.equal(normalizeEmail("Gabe@Operator.com"), "gabe@operator.com");
});

test("admin emails are not hard-coded to one company", () => {
  const policy = readEvalPolicy({
    RUNWAY_EVAL_ADMIN_EMAILS: "owner@example.com",
    RUNWAY_EVAL_ALLOWED_DOMAINS: "example.com",
  });
  assert.equal(isAdminEmail("owner@example.com", policy), true);
  assert.equal(isAdminEmail("owner@propark.com", policy), false);
  assert.equal(emailOnAllowlist("anyone@example.com", policy), true);
});

test("open registration vs allowlist", () => {
  const open = readEvalPolicy({});
  assert.equal(open.openRegistration, true);
  assert.equal(
    initialAccessStatus({ email: "a@b.co", invited: false, policy: open }),
    "active",
  );
  const closed = readEvalPolicy({
    RUNWAY_EVAL_ALLOWED_EMAILS: "in@x.com",
    RUNWAY_EVAL_OPEN_REGISTRATION: "false",
  });
  assert.equal(
    initialAccessStatus({ email: "out@x.com", invited: false, policy: closed }),
    "pending",
  );
  assert.equal(
    initialAccessStatus({ email: "out@x.com", invited: true, policy: closed }),
    "active",
  );
});

test("enforcement follows env without depending on client storage", () => {
  assert.equal(evalEnforcedFromEnv({ VITE_AUTH_ENABLED: "false" }), false);
  assert.equal(evalEnforcedFromEnv({ VITE_AUTH_ENABLED: "true" }), true);
  assert.equal(evalEnforcedFromEnv({ RUNWAY_EVAL_ENFORCE: "false" }), false);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("person@company.com"), true);
});
