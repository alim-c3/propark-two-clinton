import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getEvalAgreement } from "@/lib/eval/api";

export const Route = createFileRoute("/eval/agreement")({
  component: AgreementPage,
});

function AgreementPage() {
  const [body, setBody] = useState("Loading…");
  useEffect(() => {
    void getEvalAgreement().then((agreement) => setBody(agreement.body));
  }, []);
  return (
    <main className="min-h-screen bg-cream px-4 py-10 text-navy">
      <article className="mx-auto max-w-3xl">
        <p className="text-[10px] font-bold tracking-[0.22em] text-gold-2">RUNWAY</p>
        <h1 className="mt-2 font-display text-4xl">Runway Evaluation Terms</h1>
        <pre className="mt-8 whitespace-pre-wrap font-sans text-sm leading-7">{body}</pre>
      </article>
    </main>
  );
}
