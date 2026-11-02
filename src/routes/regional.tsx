"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Chrome } from "@/components/chrome";
import { Button } from "@/components/ui/button";
import { enforceEvalNavigation } from "@/lib/eval/guard";
import { getSiteMode } from "@/lib/site-mode";
import {
  CARS_PER_VALET_HR,
  DEMO_GARAGES,
  MOVE,
  bandOf,
  healthScore,
  nyClock,
  portfolioCall,
  scoreGarage,
  type Band,
  type Call,
  type RangeKey,
  type Scored,
  type SiteMode,
} from "@/lib/portfolio";
import { FORECAST, STALLS } from "@/lib/seed";
import { useLane } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/regional")({
  beforeLoad: () => enforceEvalNavigation("/regional"),
  loader: async () => ({ mode: await getSiteMode() }),
  component: Regional,
});

const RANGES: { id: RangeKey; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "today", label: "Today" },
  { id: "week", label: "7 days" },
];

function bandLabel(band: Band) {
  if (band === "ok") return "On target";
  if (band === "watch") return "Watch";
  return "Short";
}

function bandClass(band: Band) {
  if (band === "ok") return "bg-ok/15 text-ok";
  if (band === "watch") return "bg-gold/30 text-navy";
  return "bg-danger-soft text-danger";
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

/** Minutes past the promise. Positive means the resident is waiting longer than promised. */
function lateBy(mins: number, sla: number) {
  return Math.round(mins - sla);
}

function waitNote(mins: number, sla: number) {
  const gap = lateBy(mins, sla);
  if (gap > 0) return `${gap} min late`;
  if (gap === 0) return "on the promise";
  return `${Math.abs(gap)} min to spare`;
}

function Regional() {
  const { mode } = Route.useLoaderData();
  return mode === "live" ? <LiveBoard /> : <DemoBoard />;
}

function DemoBoard() {
  const clock = nyClock();
  const [range, setRange] = useState<RangeKey>("today");
  const [moved, setMoved] = useState(false);
  const [focus, setFocus] = useState(false);
  const [selected, setSelected] = useState("huguenot");
  const [sort, setSort] = useState<{ key: "health" | "occupancy" | "p90" | "valets"; dir: "asc" | "desc" }>({
    key: "health",
    dir: "asc",
  });

  const call = portfolioCall(range, clock.window);
  const rows = useMemo(() => {
    return DEMO_GARAGES.map((g) => {
      const extra = moved && g.id === MOVE.from ? -MOVE.count : moved && g.id === MOVE.to ? MOVE.count : 0;
      return scoreGarage(g, range, clock.window, extra);
    });
  }, [range, clock.window, moved]);

  const visible = focus ? rows.filter((r) => r.band !== "ok") : rows;
  const shown = visible.length ? visible : rows;
  const active = shown.find((r) => r.id === selected) ?? shown[0];
  const sorted = [...shown].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const pick = (r: Scored) =>
      sort.key === "health" ? r.health : sort.key === "occupancy" ? r.occupancy : sort.key === "p90" ? r.slice.retrievalP90 : r.valets;
    return (pick(a) - pick(b)) * dir;
  });

  const stalls = rows.reduce((n, r) => n + r.stalls, 0);
  const occupied = rows.reduce((n, r) => n + r.slice.occupied, 0);
  const valets = rows.reduce((n, r) => n + r.valets, 0);
  const health = Math.round(rows.reduce((n, r) => n + r.health * r.stalls, 0) / stalls);
  const attention = rows.filter((r) => r.band !== "ok").length;
  const worst = [...rows].sort((a, b) => b.slice.retrievalP90 - a.slice.retrievalP90)[0];

  function stage() {
    if (moved || call.action !== "move") return;
    setMoved(true);
    setSelected(MOVE.to);
    toast.success(call.done);
  }

  return (
    <Shell
      mode="demo"
      range={range}
      onRange={setRange}
      clockLabel={clock.label}
      windowName={clock.window}
    >
      <Kpis
        tiles={[
          ["HEALTH", String(health), bandLabel(bandOf(health))],
          ["OCCUPIED", pct(occupied / stalls), `${occupied} of ${stalls}`],
          ["VALETS", String(valets), `${valets * CARS_PER_VALET_HR} cars/hr`],
          ["LONGEST WAIT", `${worst.slice.retrievalP90} min`, `${worst.name} · ${waitNote(worst.slice.retrievalP90, worst.sla)}`],
          ["OFF TARGET", String(attention), attention ? "Needs a call" : "All inside the band"],
        ]}
      />

      <CallBanner call={call} moved={moved} onStage={stage} onUndo={() => setMoved(false)} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl">Garages</h2>
        <button
          type="button"
          onClick={() => setFocus((v) => !v)}
          className={cn(
            "inline-flex min-h-10 items-center rounded-full px-3 text-xs font-bold",
            focus ? "bg-navy text-cream" : "bg-white text-navy",
          )}
        >
          {focus ? "Showing off target" : "Only off target"}
        </button>
      </div>
      {focus && !visible.length ? (
        <p className="mt-2 text-sm text-muted">Every garage is inside the band on this range.</p>
      ) : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {shown.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelected(g.id)}
            className={cn(
              "rounded-2xl border bg-white p-4 text-left",
              active.id === g.id ? "border-gold ring-2 ring-gold" : "border-line",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-xl leading-tight">{g.name}</p>
                <p className="text-xs text-muted">{g.place}</p>
              </div>
              <span className={cn("rounded-full px-2 py-1 text-[11px] font-bold", bandClass(g.band))}>
                {bandLabel(g.band)} · {g.health}
              </span>
            </div>
            <p className="mt-3 font-display text-3xl tabular-nums">{pct(g.occupancy)}</p>
            <p className="text-xs text-muted">
              {g.slice.occupied} of {g.stalls} · {bandLabel(g.band)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-gold-2">TO THE CURB</dt>
                <dd className={cn("tabular-nums", g.slice.retrievalP90 > g.sla && "font-semibold text-danger")}>
                  {g.slice.retrievalP90} min
                </dd>
                <p className="text-[11px] text-muted">{waitNote(g.slice.retrievalP90, g.sla)}</p>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-gold-2">CREW</dt>
                <dd className="tabular-nums">
                  {g.valets} · {g.capacity}/hr
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-gold-2">{g.slice.demandLabel.toUpperCase()}</dt>
                <dd className="tabular-nums">{g.slice.demand} pulls</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-gold-2">OPEN</dt>
                <dd className="tabular-nums">{g.slice.openTickets}</dd>
              </div>
            </dl>
          </button>
        ))}
      </div>

      <section className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[10px] font-bold tracking-wide text-muted">
              <th className="px-4 py-3 font-bold">Garage</th>
              <SortTh label="Health" k="health" sort={sort} setSort={setSort} />
              <SortTh label="Occupancy" k="occupancy" sort={sort} setSort={setSort} />
              <SortTh label="To the curb" k="p90" sort={sort} setSort={setSort} />
              <SortTh label="Valets" k="valets" sort={sort} setSort={setSort} />
              <th className="px-3 py-3 font-bold">Demand</th>
              <th className="px-3 py-3 font-bold">Yield / stall</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => (
              <tr
                key={g.id}
                className={cn("border-b border-line last:border-0", active.id === g.id ? "bg-gold/10" : "")}
              >
                <td className="px-4 py-3">
                  <button type="button" className="text-left font-semibold" onClick={() => setSelected(g.id)}>
                    {g.name}
                  </button>
                  <p className="text-xs text-muted">{g.place}</p>
                </td>
                <td className="px-3 py-3 tabular-nums">{g.health}</td>
                <td className="px-3 py-3 tabular-nums">{pct(g.occupancy)}</td>
                <td className="px-3 py-3">
                  <span className={cn("tabular-nums", g.slice.retrievalP90 > g.sla && "font-semibold text-danger")}>
                    {g.slice.retrievalP90} min
                  </span>
                  <p className="text-[11px] text-muted">{waitNote(g.slice.retrievalP90, g.sla)}</p>
                </td>
                <td className="px-3 py-3 tabular-nums">{g.valets}</td>
                <td className="px-3 py-3 tabular-nums">
                  {g.slice.demand} vs {g.capacity}
                </td>
                <td className="px-3 py-3 tabular-nums">${g.yield}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-3 text-xs text-muted">
          Yield is sample dollars per stall this month. Not a bill and not the live ledger. 360 Huguenot earns more per stall and still misses the curb.
          To the curb is how long 9 of 10 residents wait. The promise is 10 minutes.
        </p>
      </section>

      <Detail garage={active} demo />
    </Shell>
  );
}

function LiveBoard() {
  const staff = useLane((s) => s.staff);
  const tickets = useLane((s) => s.tickets);
  const pulls = useLane((s) => s.pulls);
  const clock = nyClock();
  const [range, setRange] = useState<RangeKey>("now");

  const valets = Object.values(staff).filter(Boolean).length;
  const stallCount = STALLS.length;
  const occupied = STALLS.filter((s) => s.plate).length;
  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "claimed").length;
  const nested = tickets.filter((t) => t.blockedBy && t.status !== "released" && t.status !== "cancelled");
  const mins = pulls.map((p) => p.mins).filter((n) => n > 0);
  const avg = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0;
  const p90 = mins.length ? percentile(mins, 0.9) : 0;
  const hourRow = FORECAST.find((r) => r.hour === clock.label);
  const peak = [...FORECAST].sort((a, b) => b.pulls - a.pulls)[0];
  const demand = range === "now" ? (hourRow?.pulls ?? 0) : range === "today" ? peak.pulls : 42;
  const demandLabel = range === "now" ? clock.label : range === "today" ? `${peak.hour} peak` : "typical 8a";
  const incidents = nested.length ? 1 : 0;
  const occupancy = stallCount ? occupied / stallCount : 0;
  const crew = Math.max(valets, 1);
  const health = healthScore({
    retrievalP90: p90 || 10,
    sla: 10,
    occupancy: occupancy || 0.5,
    demand,
    valets: crew,
    incidents,
  });
  const band = bandOf(health);
  const capacity = crew * CARS_PER_VALET_HR;

  const zone = (match: (z: (typeof STALLS)[number]) => boolean) => {
    const rows = STALLS.filter(match);
    if (!rows.length) return 0;
    return Math.round((100 * rows.filter((s) => s.plate).length) / rows.length);
  };

  const chart = FORECAST.filter((r) => ["6a", "7a", "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p"].includes(r.hour)).map((r) => ({
    hour: r.hour,
    pulls: r.pulls,
    capacity,
  }));

  return (
    <Shell mode="live" range={range} onRange={setRange} clockLabel={clock.label} windowName={clock.window}>
      <Kpis
        tiles={[
          ["HEALTH", String(health), bandLabel(band)],
          ["OCCUPIED", pct(occupancy), `${occupied} of ${stallCount} on the demo plate`],
          ["VALETS", String(valets), valets ? `${capacity} cars/hr` : "Nobody clocked in"],
          ["TO THE CURB", mins.length ? `${p90} min` : "—", mins.length ? `9 of 10 cars · ${waitNote(p90, 10)}` : "No car has come to the curb yet"],
          ["OPEN", String(openTickets), nested.length ? `${nested.length} nested` : "No nest in the way"],
        ]}
      />

      <section className="mt-4 rounded-2xl bg-navy p-4 text-cream">
        <p className="text-[10px] font-bold tracking-[0.16em] text-gold">ONE GARAGE ON THIS LOGIN</p>
        <p className="mt-1 font-display text-2xl">A cross-site move shows up when a second garage is assigned.</p>
        <p className="mt-2 max-w-2xl text-sm text-cream/75">
          This board reads the Two Clinton floor — who’s clocked in, what’s open, what’s nested. It does not invent the other sites.
        </p>
      </section>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-gold bg-white p-4 ring-2 ring-gold lg:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-xl">Two Clinton Park</p>
              <p className="text-xs text-muted">New Rochelle · live board</p>
            </div>
            <span className={cn("rounded-full px-2 py-1 text-[11px] font-bold", bandClass(band))}>
              {bandLabel(band)} · {health}
            </span>
          </div>
          <p className="mt-3 font-display text-3xl tabular-nums">{pct(occupancy)}</p>
          <p className="text-xs text-muted">
            {demandLabel} · {demand} pulls vs {capacity} capacity
            {mins.length ? ` · usual wait ${avg} min, 9 of 10 by ${p90}` : ""}
          </p>
          <div className="mt-4">
            <Button asChild variant="navy" size="sm">
              <Link to="/manager">Open site board</Link>
            </Button>
          </div>
        </article>
        <article className="rounded-2xl border border-dashed border-line bg-white p-4">
          <p className="font-display text-xl">Next garage</p>
          <p className="mt-2 text-sm text-muted">
            Assigned garages land here. Until then this seat is Two Clinton only.
          </p>
        </article>
      </div>

      <section className="mt-4 rounded-2xl border border-line bg-white p-4">
        <h2 className="font-display text-2xl">Two Clinton · 6a–8p</h2>
        <p className="mt-1 text-sm text-muted">Line is {crew} valet{crew === 1 ? "" : "s"} × {CARS_PER_VALET_HR} cars/hr. Same rule as the site board.</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" interval={0} tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="pulls" name="Pulls" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="capacity" name="Capacity" stroke="var(--color-ok)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Zone name="Hot" value={zone((s) => s.zone === "hot")} />
          <Zone name="Warm" value={zone((s) => s.zone === "midAisle" || s.zone === "midWall")} />
          <Zone name="Cold" value={zone((s) => s.zone === "deep")} />
          <Zone name="Stack" value={zone((s) => Boolean(s.liftDeck))} />
        </div>
        {nested[0] ? (
          <p className="mt-4 text-sm">
            Nest in the way: {nested[0].blockedBy} in front of {nested[0].plate}.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">No nested car on the open board.</p>
        )}
      </section>
    </Shell>
  );
}

function Shell({
  mode,
  range,
  onRange,
  clockLabel,
  windowName,
  children,
}: {
  mode: SiteMode;
  range: RangeKey;
  onRange: (r: RangeKey) => void;
  clockLabel: string;
  windowName: string;
  children: ReactNode;
}) {
  const demo = mode === "demo";
  return (
    <div className="min-h-screen bg-cream">
      <Chrome />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
          {demo ? "REGIONAL · DEMO PORTFOLIO" : "REGIONAL · LIVE"}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl">{demo ? "Three garages. One floor." : "Garages on this login."}</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              {demo
                ? `RXR New Rochelle. Sample book. New York ${clockLabel} · ${windowName}. Not the live ledger.`
                : `New York ${clockLabel}. Two Clinton is the only live site.`}
            </p>
          </div>
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onRange(r.id)}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full px-3 text-xs font-bold",
                  range === r.id ? "bg-navy text-cream" : "bg-white text-navy",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Kpis({ tiles }: { tiles: [string, string, string][] }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map(([k, v, s]) => (
        <div key={k} className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[10px] font-bold tracking-[0.14em] text-gold-2">{k}</p>
          <p className="font-display text-3xl tabular-nums">{v}</p>
          <p className="text-xs text-muted">{s}</p>
        </div>
      ))}
    </div>
  );
}

function CallBanner({
  call,
  moved,
  onStage,
  onUndo,
}: {
  call: Call;
  moved: boolean;
  onStage: () => void;
  onUndo: () => void;
}) {
  const showMove = call.action === "move";
  return (
    <section className={cn("mt-4 rounded-2xl p-4", showMove && !moved ? "bg-gold/25" : "bg-navy text-cream")}>
      <p className={cn("text-[10px] font-bold tracking-[0.16em]", showMove && !moved ? "text-navy" : "text-gold")}>
        {moved ? "STAGED" : "THE CALL"}
      </p>
      <p className="mt-1 font-display text-2xl">{moved && showMove ? "Move is staged." : call.title}</p>
      <p className={cn("mt-2 max-w-3xl text-sm", showMove && !moved ? "text-navy" : "text-cream/80")}>
        {moved && showMove ? call.done : call.body}
      </p>
      {showMove ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {moved ? (
            <Button variant="gold" size="sm" onClick={onUndo}>
              Undo
            </Button>
          ) : (
            <Button variant="navy" size="sm" onClick={onStage}>
              Stage the move
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Detail({ garage, demo }: { garage: Scored; demo?: boolean }) {
  const chart = garage.hourly.map((row) => ({
    ...row,
    capacity: garage.capacity,
  }));
  return (
    <section className="mt-4 rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">{garage.place.toUpperCase()}</p>
          <h2 className="font-display text-2xl">{garage.name}</h2>
          <p className="mt-1 text-sm text-muted">{garage.fit}</p>
          <p className="mt-2 max-w-xl text-sm">
            Usual wait {garage.slice.retrievalAvg} min. 9 of 10 cars are at the curb by {garage.slice.retrievalP90}. The promise is {garage.sla} minutes
            {lateBy(garage.slice.retrievalP90, garage.sla) > 0
              ? ` — that is ${lateBy(garage.slice.retrievalP90, garage.sla)} min late.`
              : "."}
          </p>
        </div>
        {garage.id === "tcp" ? (
          <Button asChild variant="navy" size="sm">
            <Link to="/manager">Open site board</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted">Site board in this demo is Two Clinton.</p>
        )}
      </div>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" interval={0} tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="pulls" name="Pulls" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
            <Line type="monotone" dataKey="capacity" name="Capacity" stroke="var(--color-ok)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted">
        Bars are pulls. Line is {garage.valets} × {CARS_PER_VALET_HR} cars/hr.
        {demo ? " Demo curve, not today’s live tickets." : ""}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Zone name="Hot" value={garage.zones.hot} />
        <Zone name="Warm" value={garage.zones.warm} />
        <Zone name="Cold" value={garage.zones.cold} />
        <Zone name="Stack" value={garage.zones.stack} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-xl">Exceptions</h3>
          <ul className="mt-2 space-y-2">
            {garage.notes.map((n) => (
              <li key={n.text} className="rounded-xl bg-cream px-3 py-2 text-sm">
                <span className="font-semibold">{n.when}. </span>
                {n.text}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-xl">Street cred</h3>
          <ul className="mt-2 space-y-2">
            {garage.cred.map((c) => (
              <li key={c.unit} className="rounded-xl bg-cream px-3 py-2 text-sm">
                <span className="font-semibold">{c.unit}</span>
                <span className="tabular-nums text-muted"> · {c.score}</span>
                <p className="text-muted">{c.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Zone({ name, value }: { name: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold">{name}</span>
        <span className="tabular-nums text-muted">{value}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full", value >= 95 ? "bg-danger" : "bg-gold")} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  setSort,
}: {
  label: string;
  k: "health" | "occupancy" | "p90" | "valets";
  sort: { key: string; dir: "asc" | "desc" };
  setSort: (s: { key: "health" | "occupancy" | "p90" | "valets"; dir: "asc" | "desc" }) => void;
}) {
  const on = sort.key === k;
  return (
    <th className="px-3 py-3 font-bold">
      <button
        type="button"
        className="min-h-10"
        onClick={() => setSort({ key: k, dir: on && sort.dir === "asc" ? "desc" : "asc" })}
      >
        {label}
        {on ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
