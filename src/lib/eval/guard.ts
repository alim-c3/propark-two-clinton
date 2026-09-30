import { redirect } from "@tanstack/react-router";
import { getEvalStatus } from "./api";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/eval/terms",
  "/eval/agreement",
  "/eval/pending",
  "/eval/revoked",
];

export function isPublicEvalPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}

export async function enforceEvalNavigation(pathname: string) {
  if (isPublicEvalPath(pathname)) return;
  const status = await getEvalStatus();
  if (!status.enforced) return;
  const next = pathname || "/";
  if (!status.authenticated || !status.emailVerified) {
    throw redirect({ to: "/login", search: { next } });
  }
  if (status.accessStatus === "revoked") {
    throw redirect({ to: "/eval/revoked" });
  }
  if (status.accessStatus !== "active") {
    throw redirect({ to: "/eval/pending" });
  }
  if (!status.acceptedCurrentTerms) {
    throw redirect({ to: "/eval/terms", search: { next } });
  }
}
