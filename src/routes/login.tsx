import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { EvalShell } from "@/components/eval-shell";
import { Button } from "@/components/ui/button";

type Search = { next?: string; email?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    next: typeof search.next === "string" ? search.next : "/",
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: LoginPage,
});

function destination(next: string | undefined, fallback = "/resident") {
  if (!next || next === "/" || next === "/login") return fallback;
  return next;
}

/** Step one only: collect the email, then go to the terms. No code is sent here. */
function LoginPage() {
  const { next, email: presetEmail } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(presetEmail ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await navigate({
        to: "/eval/terms",
        search: { next: destination(next), email: email.trim().toLowerCase() },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <EvalShell>
      <h1 className="mt-3 font-display text-3xl">Welcome to Runway</h1>
      <p className="mt-2 text-sm text-cream/70">
        Enter your email. Next you&rsquo;ll accept the terms, then we&rsquo;ll email you a 6-digit
        code.
      </p>
      <form className="mt-6 space-y-3" onSubmit={(event) => void submit(event)}>
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
        <Button type="submit" variant="gold" size="block" disabled={busy}>
          Continue
        </Button>
      </form>
    </EvalShell>
  );
}
