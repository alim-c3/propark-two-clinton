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

function fmtTime(value: unknown): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

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

  const pendingCount = (directory?.evaluators ?? []).filter(
    (row) => row.access_status === "pending" || row.access_status === "invited",
  ).length;

  function approve(address: string) {
    void inviteEvalUser({ data: { email: address } })
      .then(() => refresh())
      .catch((err) => setError(err instanceof Error ? err.message : "Approve failed"));
  }

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
        {pendingCount > 0 ? (
          <p className="mt-2 text-sm font-semibold text-gold-2">
            {pendingCount} waiting for approval
          </p>
        ) : null}
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
            placeholder="Add an email to the approved list"
            className="min-w-64 flex-1 rounded-xl border border-line bg-white px-3 py-3 text-sm"
          />
          <Button type="submit">Approve email</Button>
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
                  <td className="px-3 py-2">{fmtTime(row.accepted_at)}</td>
                  <td className="px-3 py-2">
                    {row.access_status !== "active" ? (
                      <button
                        type="button"
                        className="mr-3 font-semibold text-gold-2 underline-offset-4 hover:underline"
                        onClick={() => approve(row.email)}
                      >
                        Approve
                      </button>
                    ) : null}
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
        <h2 className="mt-10 font-display text-2xl">Every terms acceptance</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy text-cream">
              <tr>
                <th className="px-3 py-2">Accepted</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">Device</th>
                <th className="px-3 py-2">Time zone</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Status then</th>
              </tr>
            </thead>
            <tbody>
              {(directory?.acceptances ?? []).map((row) => (
                <tr key={String(row.id)} className="border-t border-line">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtTime(row.accepted_at)}</td>
                  <td className="px-3 py-2">{row.name ? String(row.name) : "—"}</td>
                  <td className="px-3 py-2">{String(row.email)}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.ip_address ? String(row.ip_address) : "—"}
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-xs" title={String(row.user_agent ?? "")}>
                    {row.user_agent ? String(row.user_agent) : "—"}
                  </td>
                  <td className="px-3 py-2">{row.time_zone ? String(row.time_zone) : "—"}</td>
                  <td className="px-3 py-2">{String(row.agreement_version)}</td>
                  <td className="px-3 py-2">{String(row.account_status ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
