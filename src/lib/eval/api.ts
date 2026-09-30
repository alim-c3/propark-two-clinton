import { createServerFn } from "@tanstack/react-start";
import { isValidEmail, normalizeEmail } from "./crypto";

export type EvalStatusDto = {
  enforced: boolean;
  authenticated: boolean;
  emailVerified: boolean;
  email: string | null;
  name: string | null;
  organization: string | null;
  evaluatorId: string | null;
  accessStatus: string | null;
  acceptedCurrentTerms: boolean;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  isAdmin: boolean;
  requiredVersion: string;
  canAccess: boolean;
};

async function requestOrigin(): Promise<string> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) return "http://localhost:8080";
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:8080";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export const getEvalStatus = createServerFn({ method: "POST" }).handler(
  async (): Promise<EvalStatusDto> => {
    const { readEvalStatus } = await import("./access.server");
    return readEvalStatus();
  },
);

export const startEvalSignIn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email ?? "");
    if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
    const { beginSignIn } = await import("./otp.server");
    return beginSignIn(email, await requestOrigin());
  });

export const requestEvalCode = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email ?? "");
    if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
    const { requestOtp } = await import("./otp.server");
    return requestOtp(email, await requestOrigin());
  });

export const verifyEvalCode = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; code: string }) => data)
  .handler(async ({ data }) => {
    const { verifyOtp } = await import("./otp.server");
    return verifyOtp(data.email, data.code);
  });

export const acceptEvalTerms = createServerFn({ method: "POST" })
  .inputValidator((data: { name?: string; organization?: string }) => data)
  .handler(async ({ data }) => {
    const { recordAcceptance } = await import("./access.server");
    return recordAcceptance({
      name: data.name?.trim() || null,
      organization: data.organization?.trim() || null,
    });
  });

export const signOutEval = createServerFn({ method: "POST" }).handler(async () => {
  const { clearEvalSession } = await import("./access.server");
  await clearEvalSession();
  return { ok: true };
});

export const getEvalAgreement = createServerFn({ method: "POST" }).handler(async () => {
  const { currentAgreement } = await import("./agreement");
  const { ensureAgreementSeeded } = await import("./access.server");
  await ensureAgreementSeeded();
  return currentAgreement();
});

export const listEvalDirectory = createServerFn({ method: "POST" }).handler(async () => {
  const { readEvalStatus, listEvaluators, listAcceptances } = await import("./access.server");
  const status = await readEvalStatus();
  if (!status.isAdmin) throw new Error("Forbidden");
  const [evaluators, acceptances] = await Promise.all([
    listEvaluators(),
    listAcceptances(),
  ]);
  return { evaluators, acceptances };
});

export const inviteEvalUser = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email ?? "");
    if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
    const { readEvalStatus, inviteEvaluator } = await import("./access.server");
    const { sendEvalEmail } = await import("./email.server");
    const status = await readEvalStatus();
    if (!status.isAdmin || !status.email) throw new Error("Forbidden");
    await inviteEvaluator({ email, invitedBy: status.email });
    await sendEvalEmail({
      to: email,
      subject: "You are invited to evaluate Runway",
      text: `You have been invited to evaluate Runway.\n\nOpen ${await requestOrigin()}/login and verify this email address to continue.`,
    });
    return { ok: true };
  });

export const revokeEvalUser = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const { readEvalStatus, revokeEvaluator } = await import("./access.server");
    const status = await readEvalStatus();
    if (!status.isAdmin) throw new Error("Forbidden");
    await revokeEvaluator(data.email);
    return { ok: true };
  });

export const requireProtectedEvalApi = createServerFn({ method: "POST" }).handler(async () => {
  const { assertProtectedEvalAccess } = await import("./access.server");
  return assertProtectedEvalAccess();
});
