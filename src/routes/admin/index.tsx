import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { enforceEvalNavigation } from "@/lib/eval/guard";
import { decideEvalRequest, endEvalAccess, getAdminLedger, getEvalStatus } from "@/lib/eval/api";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => enforceEvalNavigation("/admin"),
  component: AdminLedgerPage,
});

function when(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function cell(value: unknown) {
  const text = value == null || value === "" ? "—" : String(value);
  return text;
}

function AdminLedgerPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof getAdminLedger>> | null>(null);

  async function refresh() {
    const status = await getEvalStatus();
    if (!status.authenticated) {
      await navigate({ to: "/login", search: { next: "/admin" } });
      return;
    }
    setLedger(await getAdminLedger());
  }

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load"));
  }, [navigate]);

  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-navy">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-4xl">Admin</h1>
        {error ? <p className="mt-6 text-sm text-danger">{error}</p> : null}
        {!error && !ledger ? <p className="mt-6 text-sm text-muted">Loading…</p> : null}
        {ledger ? (
          <>
            <h2 className="mt-8 font-display text-2xl">Eval requests</h2>
            <p className="mt-1 text-sm text-muted">{ledger.requests.length} recorded</p>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy text-cream">
                  <tr>
                    <th className="px-3 py-2">Requested</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Decided</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.requests.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="px-3 py-2 whitespace-nowrap">{when(row.requested_at)}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2 capitalize">{row.status}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{when(row.decided_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {row.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-cream"
                                onClick={() =>
                                  void decideEvalRequest({ data: { id: row.id, decision: "approved" } })
                                    .then(refresh)
                                    .catch((err) =>
                                      setError(err instanceof Error ? err.message : "Could not approve"),
                                    )
                                }
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-danger"
                                onClick={() =>
                                  void decideEvalRequest({ data: { id: row.id, decision: "rejected" } })
                                    .then(refresh)
                                    .catch((err) =>
                                      setError(err instanceof Error ? err.message : "Could not reject"),
                                    )
                                }
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          {row.status === "approved" && row.email !== "alim@c3inspire.com" ? (
                            <button
                              type="button"
                              className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-danger"
                              onClick={() =>
                                void endEvalAccess({ data: { email: row.email } })
                                  .then(refresh)
                                  .catch((err) =>
                                    setError(err instanceof Error ? err.message : "Could not end the eval"),
                                  )
                              }
                            >
                              End eval
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2 className="mt-10 font-display text-2xl">Logins</h2>
            <p className="mt-1 text-sm text-muted">{ledger.logins.length} recorded</p>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy text-cream">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.logins.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="px-3 py-2 whitespace-nowrap">{when(row.logged_in_at)}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">{row.method}</td>
                      <td className="px-3 py-2">{cell(row.ip_address)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2 className="mt-10 font-display text-2xl">Accepted terms</h2>
            <p className="mt-1 text-sm text-muted">{ledger.acceptances.length} recorded</p>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy text-cream">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Organization</th>
                    <th className="px-3 py-2">Version</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.acceptances.map((row) => (
                    <tr key={String(row.id)} className="border-t border-line">
                      <td className="px-3 py-2 whitespace-nowrap">{when(row.accepted_at)}</td>
                      <td className="px-3 py-2">{cell(row.email)}</td>
                      <td className="px-3 py-2">{cell(row.name)}</td>
                      <td className="px-3 py-2">{cell(row.organization)}</td>
                      <td className="px-3 py-2">{cell(row.agreement_version)}</td>
                      <td className="px-3 py-2">{cell(row.acceptance_method)}</td>
                      <td className="px-3 py-2">{cell(row.ip_address)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
