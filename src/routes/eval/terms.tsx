import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EvalShell } from "@/components/eval-shell";
import { Button } from "@/components/ui/button";
import { acceptEvalTerms, getEvalAgreement, getEvalStatus } from "@/lib/eval/api";
import { EVAL_ACCEPTANCE_TEXT } from "@/lib/eval/config";
import { TermsDocument } from "@/lib/eval/terms-document";

type Search = { next?: string };

export const Route = createFileRoute("/eval/terms")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    next: typeof search.next === "string" ? search.next : "/",
  }),
  component: TermsPage,
});

function TermsPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const status = await getEvalStatus();
      if (!status.enforced) {
        await navigate({ to: (next || "/") as "/" });
        return;
      }
      if (!status.authenticated) {
        await navigate({ to: "/login", search: { next: next || "/" } });
        return;
      }
      if (status.canAccess) {
        await navigate({ to: (next || "/") as "/" });
        return;
      }
      const agreement = await getEvalAgreement();
      setBody(agreement.body);
    })();
  }, [navigate, next]);

  async function accept() {
    if (!agreed) return;
    setBusy(true);
    setError(null);
    try {
      await acceptEvalTerms({ data: {} });
      await navigate({ to: (next || "/") as "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record acceptance.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <EvalShell>
      <h1 className="mt-3 font-display text-3xl">Welcome to Runway</h1>
      <p className="mt-3 text-sm leading-6 text-cream/75">
        This environment is provided for internal evaluation of Runway and its capabilities.
      </p>
      <label className="mt-6 flex items-start gap-3 text-sm leading-6 text-cream">
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
        type="button"
        variant="gold"
        size="block"
        className="mt-6"
        disabled={!agreed || busy}
        onClick={() => void accept()}
      >
        {busy ? "Saving…" : "Agree & Continue"}
      </Button>
      <p className="mt-4 text-xs leading-5 text-cream/55">
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
