import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PitchNav } from "@/components/pitch-nav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="min-h-screen bg-navy text-cream">
      <PitchNav />
      <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden">
        <img
          src="/clinton-hero.jpg"
          alt="Two Clinton Park, New Rochelle"
          className="absolute inset-0 h-full w-full object-cover object-[center_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/75 to-navy/35" />
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col justify-center px-5 py-16 sm:px-10">
          <h1 className="font-display text-4xl text-cream sm:text-6xl">
            Get going. We’ll help you take off.
          </h1>
          <p className="mt-4 max-w-xl text-base text-cream/90 sm:text-lg">
            Enter your email to evaluate Runway. Confirm it with a code and accept the terms.
            Once you&rsquo;re approved, Features, Resident, Valet, and Manager open for you.
          </p>
          <HomeAccessForm />
        </div>
      </div>
    </main>
  );
}

function HomeAccessForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The code step lives on /login; typing an email alone never signs anyone in.
      await navigate({ to: "/login", search: { next: "/resident", email } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="mt-8 w-full max-w-xl rounded-3xl border border-cream/15 bg-navy/80 p-6 shadow-2xl backdrop-blur-sm sm:p-8"
      onSubmit={(event) => void submit(event)}
    >
      <label className="block text-sm font-semibold tracking-wide text-cream">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="mt-3 w-full rounded-2xl border border-cream/25 bg-navy px-4 py-4 text-base text-cream outline-none placeholder:text-cream/35 focus:border-gold"
        />
      </label>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <Button type="submit" variant="gold" size="block" className="mt-5" disabled={busy}>
        {busy ? "Checking…" : "Continue to Runway"}
      </Button>
    </form>
  );
}
