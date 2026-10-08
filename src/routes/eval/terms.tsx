import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { EvalShell } from "@/components/eval-shell";
import { Button } from "@/components/ui/button";
import {
  acceptEvalTermsAndSendCode,
  getEvalAgreement,
  getEvalStatus,
  verifyEvalCode,
} from "@/lib/eval/api";
import { EVAL_ACCEPTANCE_TEXT } from "@/lib/eval/config";
import { TermsDocument } from "@/lib/eval/terms-document";

type Search = { next?: string; email?: string };
type Step = "terms" | "code" | "approved";

export const Route = createFileRoute("/eval/terms")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    next: typeof search.next === "string" ? search.next : "/",
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: TermsPage,
});

/**
 * Every sign-in runs the same three steps:
 * 1. accept the terms (stored and emailed to the admin every time),
 * 2. enter the 6-digit code that is emailed right after,
 * 3. see either "waiting for approval" or the way in.
 */
function TermsPage() {
  const { next, email } = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("terms");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const destination = !next || next === "/" ? "/resident" : next;

  useEffect(() => {
    void (async () => {
      if (!email) {
        await navigate({ to: "/login", search: { next: destination } });
        return;
      }
      const status = await getEvalStatus();
      if (!status.enforced) {
        await navigate({ to: destination as "/" });
        return;
      }
      const agreement = await getEvalAgreement();
      setBody(agreement.body);
    })();
  }, [navigate, destination, email]);

  async function acceptAndSendCode(event: FormEvent) {
    event.preventDefault();
    if (!agreed || !name.trim() || !email) return;
    setBusy(true);
    setError(null);
    try {
      const result = await acceptEvalTermsAndSendCode({
        data: {
          email,
          name,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          screen: `${window.screen.width}x${window.screen.height}`,
          referrer: document.referrer,
        },
      });
      setNotice(
        result.delivered
          ? `We emailed a 6-digit code to ${email}.`
          : result.devCode
            ? `Development code: ${result.devCode}`
            : "A code was generated. If email delivery is not configured, check the server log.",
      );
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record acceptance.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyEvalCode({ data: { email, code } });
      if (result.accessStatus === "active") {
        setStep("approved");
        return;
      }
      await navigate({ to: "/eval/pending" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify that code.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "approved") {
    return (
      <EvalShell>
        <h1 className="mt-3 font-display text-3xl">You&rsquo;re approved</h1>
        <p className="mt-3 text-sm leading-6 text-cream/75">
          Your email is confirmed and you&rsquo;re on the approved list. You can start using
          Runway now.
        </p>
        <Button
          type="button"
          variant="gold"
          size="block"
          className="mt-6"
          onClick={() => void navigate({ to: destination as "/" })}
        >
          Start using Runway
        </Button>
      </EvalShell>
    );
  }

  if (step === "code") {
    return (
      <EvalShell>
        <h1 className="mt-3 font-display text-3xl">Enter your code</h1>
        {notice ? <p className="mt-3 text-sm text-gold">{notice}</p> : null}
        <form className="mt-5 space-y-3" onSubmit={(event) => void verify(event)}>
          <label className="block text-xs font-semibold tracking-wide text-cream/70">
            6-digit code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 w-full rounded-xl border border-navy-2 bg-navy px-3 py-3 text-sm tracking-[0.3em] text-cream outline-none focus:border-gold"
              placeholder="000000"
            />
          </label>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button
            type="submit"
            variant="gold"
            size="block"
            disabled={busy || code.length !== 6}
          >
            {busy ? "Checking…" : "Continue"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 text-xs text-cream/55 underline-offset-4 hover:underline"
          onClick={() => {
            setStep("terms");
            setCode("");
            setNotice(null);
            setError(null);
          }}
        >
          Start over
        </button>
      </EvalShell>
    );
  }

  return (
    <EvalShell>
      <h1 className="mt-3 font-display text-3xl">Welcome to Runway</h1>
      <p className="mt-3 text-sm leading-6 text-cream/75">
        This environment is provided for internal evaluation of Runway and its capabilities.
        Signing in as <span className="text-cream">{email}</span>.
      </p>
      <form onSubmit={(event) => void acceptAndSendCode(event)}>
        <label className="mt-6 block text-xs font-semibold tracking-wide text-cream/70">
          Your full name
          <input
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-xl border border-navy-2 bg-navy px-3 py-3 text-sm text-cream outline-none focus:border-gold"
            placeholder="First and last name"
          />
        </label>
        <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-cream">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[#f5b942]"
          />
          <span>
            I have read and agree to the{" "}
            <button
              type="button"
              className="text-gold underline underline-offset-4"
              onClick={() => setOpen(true)}
            >
              Runway Evaluation Terms
            </button>
            .
          </span>
        </label>
        <Button
          type="submit"
          variant="gold"
          size="block"
          className="mt-6"
          disabled={!agreed || !name.trim() || busy}
        >
          {busy ? "Saving…" : "Agree & Continue"}
        </Button>
      </form>
      <p className="mt-4 text-xs leading-5 text-cream/55">
        When you accept, we record your name, email, IP address, and device details. You&rsquo;ll
        accept the terms each time you sign in.
      </p>
      <p className="mt-2 text-xs leading-5 text-cream/55">
        {EVAL_ACCEPTANCE_TEXT.replace("Runway Evaluation Terms.", "")}
        <Link to="/eval/agreement" className="text-gold underline underline-offset-4">
          Runway Evaluation Terms
        </Link>
        .
      </p>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-8 w-full max-w-3xl rounded-2xl bg-cream p-6 text-navy">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl">Runway Evaluation Terms</h2>
              <button
                type="button"
                className="text-sm text-muted underline-offset-4 hover:underline"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto pr-1">
              {body ? <TermsDocument body={body} /> : <p>Loading…</p>}
            </div>
          </div>
        </div>
      ) : null}
    </EvalShell>
  );
}
