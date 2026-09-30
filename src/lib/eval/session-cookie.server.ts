import { SignJWT, jwtVerify } from "jose";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import {
  EVAL_SESSION_COOKIE,
  EVAL_SESSION_TTL_SECONDS,
  RUNWAY_EVALUATION_TERMS_VERSION,
  type EvaluatorAccessStatus,
} from "./config";
import { env } from "@/lib/env.server";
import { newId, normalizeEmail } from "./crypto";

export type EvalSessionClaims = {
  email: string;
  verified: boolean;
  accessStatus: EvaluatorAccessStatus;
  acceptedVersion: string | null;
  evaluatorId: string;
};

function sessionSecret(): Uint8Array {
  const raw =
    env("RUNWAY_EVAL_SESSION_SECRET") ??
    env("BETTER_AUTH_SECRET") ??
    "runway-eval-dev-secret-change-me";
  return new TextEncoder().encode(raw);
}

export async function writeEvalCookie(claims: EvalSessionClaims): Promise<void> {
  const jwt = await new SignJWT({
    email: claims.email,
    verified: claims.verified,
    accessStatus: claims.accessStatus,
    acceptedVersion: claims.acceptedVersion,
    eid: claims.evaluatorId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.evaluatorId)
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
}

export function blankEvalCookie(): void {
  setCookie(EVAL_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
}

export async function readEvalCookie(): Promise<EvalSessionClaims | null> {
  const token = getCookie(EVAL_SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    if (!email) return null;
    const accessStatus =
      payload.accessStatus === "revoked" ||
      payload.accessStatus === "pending" ||
      payload.accessStatus === "invited" ||
      payload.accessStatus === "active"
        ? payload.accessStatus
        : "active";
    return {
      email,
      verified: payload.verified === true,
      accessStatus,
      acceptedVersion:
        typeof payload.acceptedVersion === "string" ? payload.acceptedVersion : null,
      evaluatorId:
        typeof payload.eid === "string"
          ? payload.eid
          : typeof payload.sub === "string"
            ? payload.sub
            : newId("eval"),
    };
  } catch {
    return null;
  }
}

export function cookieHasCurrentTerms(claims: EvalSessionClaims | null): boolean {
  return claims?.acceptedVersion === RUNWAY_EVALUATION_TERMS_VERSION;
}
