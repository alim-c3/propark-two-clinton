import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RUNWAY_EVALUATION_TERMS_EFFECTIVE_DATE,
  RUNWAY_EVALUATION_TERMS_NAME,
  RUNWAY_EVALUATION_TERMS_VERSION,
} from "./config";
import { sha256Hex } from "./crypto";

export type AgreementSnapshot = {
  name: string;
  version: string;
  effectiveDate: string;
  body: string;
  sha256: string;
};

function legalRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../../legal");
}

export function loadAgreementFile(version = RUNWAY_EVALUATION_TERMS_VERSION): string {
  const immutable = join(legalRoot(), "versions", `${version}.md`);
  try {
    return readFileSync(immutable, "utf8");
  } catch {
    return readFileSync(join(legalRoot(), "RUNWAY_EVALUATION_TERMS.md"), "utf8");
  }
}

export function currentAgreement(): AgreementSnapshot {
  const body = loadAgreementFile(RUNWAY_EVALUATION_TERMS_VERSION);
  return {
    name: RUNWAY_EVALUATION_TERMS_NAME,
    version: RUNWAY_EVALUATION_TERMS_VERSION,
    effectiveDate: RUNWAY_EVALUATION_TERMS_EFFECTIVE_DATE,
    body,
    sha256: sha256Hex(body),
  };
}
