import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EvalShell } from "@/components/eval-shell";
import { getEvalStatus } from "@/lib/eval/api";

export const Route = createFileRoute("/eval/pending")({
  component: function PendingPage() {
    const [status, setStatus] = useState<string | null>(null);
    useEffect(() => {
      void getEvalStatus()
        .then((next) => setStatus(next.accessStatus))
        .catch(() => setStatus("pending"));
    }, []);
    const copy =
      status === "rejected"
        ? "This request was not approved. Submit your email again if you want to request another evaluation."
        : status === "ended"
          ? "This evaluation has ended. Submit your email again to request a new one."
          : status === "revoked"
            ? "Evaluation access for this email has been revoked."
            : "Your evaluation request is waiting for approval. You can use the demo after it is approved.";
    return (
      <EvalShell>
        <h1 className="mt-3 font-display text-3xl">
          {status === "ended" ? "Evaluation ended" : status === "rejected" ? "Request not approved" : "Access pending"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-cream/75">{copy}</p>
        <Link to="/" className="mt-6 inline-block text-sm text-gold underline underline-offset-4">
          Request again
        </Link>
      </EvalShell>
    );
  },
});