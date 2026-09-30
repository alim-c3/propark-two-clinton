import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { EvalShell } from "@/components/eval-shell";
import { Button } from "@/components/ui/button";
import { requestEvalCode, verifyEvalCode } from "@/lib/eval/api";

type Search = { next?: string; email?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    next: typeof search.next === "string" ? search.next : "/",
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { next, email: presetEmail } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(presetEmail ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await requestEvalCode({ data: { email } });
      setSent(true);
      setNotice(
        result.delivered
          ? "Check your email for a 6-digit code."
          : result.devCode
            ? `Development code: ${result.devCode}`
            : "A sign-in code was generated. If email delivery is not configured, check the server log.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyEvalCode({ data: { email, code } });
      await navigate({ to: "/eval/terms", search: { next: next || "/" } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify that code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <EvalShell>
      <h1 className="mt-3 font-display text-3xl">Welcome to Runway</h1>
      <p className="mt-2 text-sm text-cream/70">
        Enter your work email. We will send a one-time code to verify it.
      </p>
      <form className="mt-6 space-y-3" onSubmit={sent ? verify : sendCode}>
        <label className="block text-xs font-semibold tracking-wide text-cream/70">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-navy-2 bg-navy px-3 py-3 text-sm text-cream outline-none focus:border-gold"
            placeholder="you@company.com"
          />
        </label>
        {sent ? (
          <label className="block text-xs font-semibold tracking-wide text-cream/70">
            One-time code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 w-full rounded-xl border border-navy-2 bg-navy px-3 py-3 text-sm tracking-[0.3em] text-cream outline-none focus:border-gold"
              placeholder="000000"
            />
          </label>
        ) : null}
        {notice ? <p className="text-sm text-gold">{notice}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <Button type="submit" variant="gold" size="block" disabled={busy}>
          {busy ? "Please wait…" : sent ? "Verify email" : "Send code"}
        </Button>
      </form>
      {sent ? (
        <button
          type="button"
          className="mt-4 text-xs text-cream/55 underline-offset-4 hover:underline"
          onClick={() => {
            setSent(false);
            setCode("");
            setNotice(null);
          }}
        >
          Use a different email
        </button>
      ) : null}
    </EvalShell>
  );
}
