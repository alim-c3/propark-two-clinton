import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getEvalAgreement } from "@/lib/eval/api";
import { TermsDocument } from "@/lib/eval/terms-document";

export const Route = createFileRoute("/eval/agreement")({
  component: AgreementPage,
});

function AgreementPage() {
  const [body, setBody] = useState("");
  useEffect(() => {
    void getEvalAgreement().then((agreement) => setBody(agreement.body));
  }, []);
  return (
    <main className="min-h-screen bg-cream px-4 py-10 text-navy">
      <article className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl">Runway Evaluation Terms</h1>
        <div className="mt-8">
          {body ? <TermsDocument body={body} /> : <p>Loading…</p>}
        </div>
      </article>
    </main>
  );
}
