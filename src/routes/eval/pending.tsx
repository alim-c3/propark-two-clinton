import { createFileRoute, Link } from "@tanstack/react-router";
import { EvalShell } from "@/components/eval-shell";

export const Route = createFileRoute("/eval/pending")({
  component: function PendingPage() {
    return (
      <EvalShell>
        <h1 className="mt-3 font-display text-3xl">Access pending</h1>
        <p className="mt-3 text-sm leading-6 text-cream/75">
          Your email is verified. A Runway administrator still needs to approve evaluation access
          for this address.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-gold underline underline-offset-4">
          Use a different email
        </Link>
      </EvalShell>
    );
  },
});
