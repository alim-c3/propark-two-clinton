import liveTerms from "../../../legal/RUNWAY_EVALUATION_TERMS.md?raw";
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

export function loadAgreementFile(_version = RUNWAY_EVALUATION_TERMS_VERSION): string {
  return liveTerms;
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
