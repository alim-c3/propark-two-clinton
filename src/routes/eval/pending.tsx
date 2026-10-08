import { createFileRoute, Link } from "@tanstack/react-router";
import { EvalShell } from "@/components/eval-shell";

export const Route = createFileRoute("/eval/pending")({
  component: function PendingPage() {
    return (
      <EvalShell>
        <h1 className="mt-3 font-display text-3xl">Waiting for approval</h1>
        <p className="mt-3 text-sm leading-6 text-cream/75">
          Your email is confirmed and your acceptance of the terms is on file. A Runway
          administrator still needs to approve this address. Next time you sign in you&rsquo;ll
          accept the terms again and get a new code. Once you&rsquo;re approved, that sign-in takes
          you straight into Runway.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-gold underline underline-offset-4">
          Use a different email
        </Link>
      </EvalShell>
    );
  },
});
