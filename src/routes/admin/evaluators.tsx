import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { enforceEvalNavigation } from "@/lib/eval/guard";
import {
  getEvalStatus,
  inviteEvalUser,
  listEvalDirectory,
  revokeEvalUser,
} from "@/lib/eval/api";

export const Route = createFileRoute("/admin/evaluators")({
  beforeLoad: () => enforceEvalNavigation("/admin/evaluators"),
  component: AdminEvaluatorsPage,
});

function AdminEvaluatorsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [directory, setDirectory] = useState<Awaited<ReturnType<typeof listEvalDirectory>> | null>(
    null,
  );

  async function refresh() {
    const status = await getEvalStatus();
    if (!status.isAdmin) {
      await navigate({ to: "/login", search: { next: "/admin/evaluators" } });
      return;
    }
    setDirectory(await listEvalDirectory());
  }

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load"));
  }, []);

  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-navy">
      <div className="mx-auto max-w-5xl">
        <p className="text-[10px] font-bold tracking-[0.22em] text-gold-2">RUNWAY ADMIN</p>
        <h1 className="mt-2 font-display text-4xl">Evaluators</h1>
        <form
          className="mt-6 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void inviteEvalUser({ data: { email } })
              .then(() => {
                setEmail("");
                return refresh();
              })
              .catch((err) => setError(err instanceof Error ? err.message : "Invite failed"));
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="invitee@company.com"
            className="min-w-64 flex-1 rounded-xl border border-line bg-white px-3 py-3 text-sm"
          />
          <Button type="submit">Invite</Button>
        </form>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy text-cream">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Verified</th>
                <th className="px-3 py-2">Access</th>
                <th className="px-3 py-2">Terms</th>
                <th className="px-3 py-2">Accepted</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(directory?.evaluators ?? []).map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-3 py-2">{row.email}</td>
                  <td className="px-3 py-2">{row.name ?? "—"}</td>
                  <td className="px-3 py-2">{row.organization ?? "—"}</td>
                  <td className="px-3 py-2">{row.email_verified ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{row.access_status}</td>
                  <td className="px-3 py-2">{row.accepted_version ?? "—"}</td>
                  <td className="px-3 py-2">{row.accepted_at ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.access_status !== "revoked" ? (
                      <button
                        type="button"
                        className="text-danger underline-offset-4 hover:underline"
                        onClick={() =>
                          void revokeEvalUser({ data: { email: row.email } }).then(() => refresh())
                        }
                      >
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="mt-10 font-display text-2xl">Acceptance records</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy text-cream">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Hash</th>
                <th className="px-3 py-2">Accepted</th>
                <th className="px-3 py-2">Method</th>
              </tr>
            </thead>
            <tbody>
              {(directory?.acceptances ?? []).map((row) => (
                <tr key={String(row.id)} className="border-t border-line">
                  <td className="px-3 py-2">{String(row.email)}</td>
                  <td className="px-3 py-2">{String(row.agreement_version)}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {String(row.agreement_hash).slice(0, 16)}…
                  </td>
                  <td className="px-3 py-2">{String(row.accepted_at)}</td>
                  <td className="px-3 py-2">{String(row.acceptance_method)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
