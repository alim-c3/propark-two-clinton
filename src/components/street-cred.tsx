"use client";

import { CONTACTS } from "@/lib/seed";
import { scoreOf, tierOf, type CredEvent } from "@/lib/cred";
import { useLane } from "@/lib/store";
import { cn } from "@/lib/utils";

export function StreetCredCard({ unit }: { unit: string }) {
  const cred = useLane((s) => s.cred);
  const score = scoreOf(cred, unit);
  const tier = tierOf(score);
  const mine = cred.filter((e) => e.unit === unit).slice(0, 4);
  const good = cred.filter((e) => e.unit === unit && e.pts > 0).length;
  const bad = cred.filter((e) => e.unit === unit && e.pts < 0).length;

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
        STREET CRED
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-5xl tabular-nums text-navy">{score}</p>
          <p className="mt-1 font-display text-xl text-navy">{tier.label}</p>
        </div>
        <p className="max-w-[12rem] text-right text-xs text-muted">{tier.wait}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
        <div
          className={cn(
            "h-full rounded-full",
            tier.id === "cleared" && "bg-ok",
            tier.id === "runway" && "bg-gold",
            tier.id === "holding" && "bg-gold-2",
            tier.id === "grounded" && "bg-navy",
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {good} on-time or early · {bad} false or late
      </p>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>Show up when you asked — or cancel before a valet rolls.</li>
        <li>Standing Thursday beats “now” every time.</li>
        <li>Ask-and-vanish, no-show at the curb, keys upstairs: cred drops.</li>
      </ul>
      {mine.length ? (
        <ol className="mt-3 space-y-1 border-t border-line pt-3">
          {mine.map((e, i) => (
            <CredLine key={`${e.at}-${i}`} e={e} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function CredLine({ e }: { e: CredEvent }) {
  return (
    <li className="flex items-start justify-between gap-3 text-xs">
      <span className={e.pts < 0 ? "text-navy" : "text-muted"}>{e.label}</span>
      <span
        className={cn(
          "shrink-0 tabular-nums font-semibold",
          e.pts < 0 ? "text-navy" : "text-ok",
        )}
      >
        {e.pts > 0 ? `+${e.pts}` : e.pts}
      </span>
    </li>
  );
}

export function StreetCredBoard() {
  const cred = useLane((s) => s.cred);
  const rows = CONTACTS.map((c) => {
    const score = scoreOf(cred, c.unit);
    return { ...c, score, tier: tierOf(score) };
  }).sort((a, b) => b.score - a.score);

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
        STREET CRED · RESIDENTS
      </p>
      <h2 className="mt-1 font-display text-xl">Who shows up when they ask.</h2>
      <p className="mt-1 text-sm text-muted">
        Cleared get pre-staged. Grounded now-requests go last. Residents only
        see their own number.
      </p>
      <ol className="mt-4 space-y-2">
        {rows.map((r) => (
          <li
            key={r.unit}
            className="flex items-center gap-3 rounded-xl bg-cream px-3 py-2"
          >
            <p className="w-10 shrink-0 font-display text-2xl tabular-nums text-navy">
              {r.score}
            </p>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                APT {r.unit} · {r.name}
              </p>
              <p className="text-xs text-muted">{r.tier.label}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
