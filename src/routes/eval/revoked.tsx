import { createFileRoute, Link } from "@tanstack/react-router";
import { EvalShell } from "@/components/eval-shell";

export const Route = createFileRoute("/eval/revoked")({
  component: function RevokedPage() {
    return (
      <EvalShell>
        <h1 className="mt-3 font-display text-3xl">Access revoked</h1>
        <p className="mt-3 text-sm leading-6 text-cream/75">
          Evaluation access for this email is no longer active. Historical acceptance records are
          retained.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-gold underline underline-offset-4">
          Sign in with another email
        </Link>
      </EvalShell>
    );
  },
});
