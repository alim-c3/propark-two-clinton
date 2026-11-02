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

function bandWord(band: Band) {
  if (band === "ok") return "On target";
  if (band === "watch") return "Watch";
  return "Short";
}

function tone(band: Band) {
  if (band === "short") {
    return { card: "bg-danger text-cream", soft: "text-cream/75", chip: "bg-cream/15 text-cream" };
  }
  if (band === "watch") {
    return { card: "bg-gold text-navy", soft: "text-navy/70", chip: "bg-navy/10 text-navy" };
  }
  return { card: "bg-ok text-cream", soft: "text-cream/75", chip: "bg-cream/15 text-cream" };
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function lateBy(mins: number, sla: number) {
  return Math.round(mins - sla);
}

function waitNote(mins: number, sla: number) {
  const gap = lateBy(mins, sla);
  if (gap > 0) return `${gap} min late`;
  if (gap === 0) return "on the promise";
  return `${Math.abs(gap)} min to spare`;
}

function hourNum(label: string) {
  const n = parseInt(label, 10);
  if (label.endsWith("p") && n !== 12) return n + 12;
  if (label.endsWith("a") && n === 12) return 0;
  return n;
}

function glance(g: Scored) {
  const late = lateBy(g.slice.retrievalP90, g.sla);
  const carsShort = g.slice.demand - g.capacity;
  if (g.band === "short") {
    if (carsShort > 0) {
      return `Needs a valet. ${g.slice.demand} cars at ${g.slice.demandLabel}, ${g.valets} on the floor.`;
    }
    return late > 0 ? `${late} min past the promise. The curb is not clearing.` : "Off the promise. Open it.";
  }
  if (g.band === "watch") {
    return late > 0 ? `${late} min past the promise. Not clear yet.` : "Close to the line. Keep an eye on it.";
  }
  if (carsShort > 0) return `Holding. ${g.slice.demandLabel} is tight — ${g.valets} valets, ${g.capacity} cars an hour.`;
  return "Covered. Cars are inside the 10-minute promise.";
}

function Regional() {
  const { mode } = Route.useLoaderData();
  return mode === "live" ? <LiveBoard /> : <DemoBoard />;
}

function DemoBoard() {
  const clock = nyClock();
  const [range, setRange] = useState<RangeKey>("today");
  const [moved, setMoved] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const call = portfolioCall(range, clock.window);
  const rows = useMemo(() => {
    return DEMO_GARAGES.map((g) => {
      const extra = moved && g.id === MOVE.from ? -MOVE.count : moved && g.id === MOVE.to ? MOVE.count : 0;
      return scoreGarage(g, range, clock.window, extra);
    });
  }, [range, clock.window, moved]);

  const open = rows.find((g) => g.id === openId) ?? null;

  function stage() {
    if (moved || call.action !== "move") return;
    setMoved(true);
    toast.success(call.done);
  }

  return (
    <Shell
      mode="demo"
      range={range}
      onRange={setRange}
      clockLabel={clock.label}
      windowName={clock.window}
      garages={rows.map((g) => ({ id: g.id, name: g.name }))}
      openId={openId}
      onOpen={setOpenId}
    >
      {open ? (
        <GarageFloor
          garage={open}
          demo
          move={open.id === MOVE.from || open.id === MOVE.to ? { call, moved, onStage: stage, onUndo: () => setMoved(false) } : null}
        />
      ) : (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {rows.map((g) => (
              <StatusCard key={g.id} garage={g} onOpen={() => setOpenId(g.id)} />
            ))}
          </div>
          <CallBanner call={call} moved={moved} onStage={stage} onUndo={() => setMoved(false)} />
        </>
      )}
    </Shell>
  );
}

function LiveBoard() {
  const staff = useLane((s) => s.staff);
  const tickets = useLane((s) => s.tickets);
  const pulls = useLane((s) => s.pulls);
  const clock = nyClock();
  const [range, setRange] = useState<RangeKey>("now");
  const [openId, setOpenId] = useState<string | null>(null);

  const garage = useMemo(() => {
    const onFloor = Object.values(staff).filter(Boolean).length;
    const stallCount = STALLS.length;
    const occupied = STALLS.filter((s) => s.plate).length;
    const openTickets = tickets.filter((t) => t.status === "open" || t.status === "claimed").length;
    const nested = tickets.filter((t) => t.blockedBy && t.status !== "released" && t.status !== "cancelled");
    const mins = pulls.map((p) => p.mins).filter((n) => n > 0);
    const avg = mins.length ? Math.round((mins.reduce((a, b) => a + b, 0) / mins.length) * 10) / 10 : 0;
    const p90 = mins.length ? percentile(mins, 0.9) : 0;
    const hourRow = FORECAST.find((r) => r.hour === clock.label);
    const dayHours = FORECAST.filter((r) => hourNum(r.hour) >= 5);
    const peak = [...dayHours].sort((a, b) => b.pulls - a.pulls)[0];
    const demand = range === "now" ? (hourRow?.pulls ?? 0) : range === "today" ? peak.pulls : 42;
    const demandLabel = range === "now" ? clock.label : range === "today" ? `${peak.hour} peak` : "typical 8a";
    const incidents = nested.length ? 1 : 0;
    const occupancy = stallCount ? occupied / stallCount : 0;
    const shownWait = p90 || (mins.length ? avg : 0);
    const health = healthScore({
      retrievalP90: shownWait || 10,
      sla: 10,
      occupancy: occupancy || 0.5,
      demand,
      valets: onFloor,
      incidents,
    });
    const zone = (match: (z: (typeof STALLS)[number]) => boolean) => {
      const zoneRows = STALLS.filter(match);
      if (!zoneRows.length) return 0;
      return Math.round((100 * zoneRows.filter((s) => s.plate).length) / zoneRows.length);
    };
    const scored: Scored = {
      id: "tcp",
      name: "Two Clinton Park",
      place: "New Rochelle",
      stalls: stallCount,
      sla: 10,
      yield: 0,
      zones: {
        hot: zone((s) => s.zone === "hot"),
        warm: zone((s) => s.zone === "midAisle" || s.zone === "midWall"),
        cold: zone((s) => s.zone === "deep"),
        stack: zone((s) => Boolean(s.liftDeck)),
      },
      hourly: dayHours.map((r) => ({ hour: r.hour, pulls: r.pulls })),
      cred: [],
      notes: nested[0]
        ? [{ when: "Now", text: `${nested[0].blockedBy} is in front of ${nested[0].plate}.` }]
        : [{ when: "Now", text: "No nested car on the open board." }],
      fit: "This is the live floor. The site board is the desk.",
      windows: {} as Scored["windows"],
      today: {} as Scored["today"],
      week: {} as Scored["week"],
      slice: {
        occupied,
        valets: onFloor,
        demand,
        demandLabel,
        retrievalAvg: avg,
        retrievalP90: shownWait,
        openTickets,
        incidents,
      },
      valets: onFloor,
      occupancy,
      health,
      band: bandOf(health),
      capacity: onFloor * CARS_PER_VALET_HR,
    };
    return scored;
  }, [staff, tickets, pulls, clock.label, range]);

  return (
    <Shell
      mode="live"
      range={range}
      onRange={setRange}
      clockLabel={clock.label}
      windowName={clock.window}
      garages={[{ id: garage.id, name: garage.name }]}
      openId={openId}
      onOpen={setOpenId}
    >
      {openId ? (
        <GarageFloor garage={garage} />
      ) : (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <StatusCard garage={garage} onOpen={() => setOpenId(garage.id)} />
            <article className="rounded-2xl border border-dashed border-line bg-white p-4">
              <p className="font-display text-2xl">Next garage</p>
              <p className="mt-2 text-sm text-muted">Assigned garages land here. This login is Two Clinton only.</p>
            </article>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({
  mode,
  range,
  onRange,
  clockLabel,
  windowName,
  garages,
  openId,
  onOpen,
  children,
}: {
  mode: SiteMode;
  range: RangeKey;
  onRange: (r: RangeKey) => void;
  clockLabel: string;
  windowName: string;
  garages: { id: string; name: string }[];
  openId: string | null;
  onOpen: (id: string | null) => void;
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
            <h1 className="font-display text-4xl">
              {garages.find((g) => g.id === openId)?.name ?? (demo ? "Three garages." : "This login.")}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              {demo
                ? `RXR New Rochelle. New York ${clockLabel} · ${windowName}. Red is short, yellow is close, green is covered.`
                : `New York ${clockLabel}. Two Clinton is the only live site.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-navy" htmlFor="garage-pick">
              <span className="text-[10px] font-bold tracking-[0.14em] text-gold-2">GARAGE</span>
              <select
                id="garage-pick"
                value={openId ?? "all"}
                onChange={(e) => onOpen(e.target.value === "all" ? null : e.target.value)}
                className="mt-1 block min-h-10 w-full rounded-full border border-line bg-white px-3 text-sm font-bold tracking-normal text-navy"
              >
                <option value="all">All garages</option>
                {garages.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
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
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusCard({ garage, onOpen }: { garage: Scored; onOpen: () => void }) {
  const t = tone(garage.band);
  const carsShort = garage.slice.demand - garage.capacity;
  return (
    <button type="button" onClick={onOpen} className={cn("rounded-2xl p-4 text-left", t.card)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl leading-tight">{garage.name}</p>
          <p className={cn("text-xs", t.soft)}>{garage.place}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide", t.chip)}>
          {bandWord(garage.band).toUpperCase()}
        </span>
      </div>
      <p className="mt-3 min-h-10 text-sm font-semibold">{glance(garage)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
        <Metric label="Full" value={pct(garage.occupancy)} note={`${garage.slice.occupied} of ${garage.stalls}`} soft={t.soft} />
        <Metric
          label="To the curb"
          value={`${garage.slice.retrievalP90} min`}
          note={garage.slice.retrievalP90 ? waitNote(garage.slice.retrievalP90, garage.sla) : "No pulls yet"}
          soft={t.soft}
        />
        <Metric
          label="Valets"
          value={String(garage.valets)}
          note={carsShort > 0 ? `${carsShort} cars short of ${garage.slice.demandLabel}` : `${garage.capacity}/hr covers ${garage.slice.demand}`}
          soft={t.soft}
        />
        <Metric
          label="Waiting"
          value={String(garage.slice.openTickets)}
          note={garage.slice.incidents ? `${garage.slice.incidents} incident${garage.slice.incidents === 1 ? "" : "s"}` : "No incidents"}
          soft={t.soft}
        />
      </dl>
    </button>
  );
}

function Metric({ label, value, note, soft }: { label: string; value: string; note: string; soft: string }) {
  return (
    <div>
      <dt className={cn("text-[10px] font-bold tracking-[0.14em]", soft)}>{label.toUpperCase()}</dt>
      <dd className="font-display text-2xl tabular-nums leading-tight">{value}</dd>
      <p className={cn("text-[11px]", soft)}>{note}</p>
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
        <div className="mt-3">
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

function GarageFloor({
  garage,
  demo,
  move,
}: {
  garage: Scored;
  demo?: boolean;
  move?: { call: Call; moved: boolean; onStage: () => void; onUndo: () => void } | null;
}) {
  const t = tone(garage.band);
  const [picked, setPicked] = useState("8a");
  const chart = garage.hourly.map((row) => ({ ...row, capacity: garage.capacity }));
  const hour = chart.find((row) => row.hour === picked) ?? chart[0];
  const gap = hour ? Math.max(0, hour.pulls - hour.capacity) : 0;
  const showWait = garage.slice.retrievalP90 > 0;

  return (
    <div className="mt-4">
      <section className={cn("rounded-2xl p-5", t.card)}>
        <p className={cn("text-[10px] font-bold tracking-[0.16em]", t.soft)}>{garage.place.toUpperCase()}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-4xl">{garage.name}</h2>
          <span className={cn("rounded-full px-3 py-1 text-xs font-bold tracking-wide", t.chip)}>
            {bandWord(garage.band).toUpperCase()}
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-base font-semibold">{glance(garage)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Full" value={pct(garage.occupancy)} note={`${garage.slice.occupied} of ${garage.stalls}`} soft={t.soft} />
          <Metric
            label="To the curb"
            value={showWait ? `${garage.slice.retrievalP90} min` : "—"}
            note={showWait ? `Usual ${garage.slice.retrievalAvg} · ${waitNote(garage.slice.retrievalP90, garage.sla)}` : "No pulls yet"}
            soft={t.soft}
          />
          <Metric label="Valets" value={String(garage.valets)} note={`${garage.capacity} cars/hr`} soft={t.soft} />
          <Metric
            label="Waiting"
            value={String(garage.slice.openTickets)}
            note={garage.slice.incidents ? `${garage.slice.incidents} incident${garage.slice.incidents === 1 ? "" : "s"}` : "No incidents"}
            soft={t.soft}
          />
        </dl>
      </section>

      {move ? <div className="mt-4"><CallBanner {...move} /></div> : null}

      <section className="mt-4 rounded-2xl border border-line bg-white p-4">
        <p className="font-display text-2xl text-navy">Cars per hour</p>
        <p className="text-sm text-muted">
          Day starts at 5a. Line is {garage.valets} × {CARS_PER_VALET_HR} cars/hr.
          {demo ? " Sample curve, not today’s live tickets." : ""}
        </p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chart}
              onClick={(state) => {
                const label = (state as { activeLabel?: string } | undefined)?.activeLabel;
                if (label) setPicked(label);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" interval={0} tick={{ fontSize: 9 }} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="pulls" name="Pulls" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="capacity" name="Capacity" stroke="var(--color-ok)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {chart.map((row) => (
            <button
              key={row.hour}
              type="button"
              onClick={() => setPicked(row.hour)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                picked === row.hour ? "bg-gold text-navy" : row.pulls > row.capacity ? "bg-navy/10 text-navy" : "bg-line text-muted",
              )}
            >
              {row.hour}
            </button>
          ))}
        </div>
        {hour ? (
          <div className={cn("mt-4 rounded-xl p-4", gap ? "bg-gold/20 text-navy" : "bg-navy text-cream")}>
            <p className="text-[10px] font-bold tracking-[0.16em]">{hour.hour.toUpperCase()}</p>
            <p className="mt-1 font-display text-2xl">
              {hour.pulls} pulls vs {hour.capacity} capacity
            </p>
            <p className="mt-1 text-sm opacity-80">
              {gap
                ? `Short ${gap} cars this hour. Need ${Math.ceil(hour.pulls / CARS_PER_VALET_HR)} valets.`
                : "Covered if the floor holds."}
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-white p-4">
        <h2 className="font-display text-2xl">The floor</h2>
        <p className="mt-1 text-sm text-muted">{garage.fit}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Zone name="Hot" value={garage.zones.hot} />
          <Zone name="Warm" value={garage.zones.warm} />
          <Zone name="Cold" value={garage.zones.cold} />
          <Zone name="Stack" value={garage.zones.stack} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-xl">What happened</h3>
            <ul className="mt-2 space-y-2">
              {garage.notes.map((n) => (
                <li key={n.text} className="rounded-xl bg-cream px-3 py-2 text-sm">
                  <span className="font-semibold">{n.when}. </span>
                  {n.text}
                </li>
              ))}
            </ul>
          </div>
          {garage.cred.length ? (
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
          ) : (
            <div>
              <h3 className="font-display text-xl">Site board</h3>
              <p className="mt-2 text-sm text-muted">Tickets, the map, and the crew live on the site board.</p>
            </div>
          )}
        </div>
        <div className="mt-4">
          {garage.id === "tcp" ? (
            <Button asChild variant="navy" size="sm">
              <Link to="/manager">Open site board</Link>
            </Button>
          ) : (
            <p className="text-xs text-muted">Site board in this demo is Two Clinton.</p>
          )}
        </div>
      </section>
    </div>
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

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
