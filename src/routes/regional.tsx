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
  MORNINGS,
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
  type WindowKey,
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
  const [sent, setSent] = useState(false);
  const [held, setHeld] = useState(false);
  const [planned, setPlanned] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const call = portfolioCall(range, clock.window);
  const rows = useMemo(() => {
    return DEMO_GARAGES.map((g) => {
      const extra = sent && g.id === MOVE.from ? -MOVE.count : sent && g.id === MOVE.to ? MOVE.count : 0;
      return scoreGarage(g, range, clock.window, extra);
    });
  }, [range, clock.window, sent]);

  const ranked = [...rows].sort((a, b) => a.health - b.health);
  const open = rows.find((g) => g.id === openId) ?? null;
  const acted = call.action === "send" ? sent : call.action === "plan" ? planned : held;

  function act() {
    if (acted) return;
    if (call.action === "send") setSent(true);
    else if (call.action === "plan") setPlanned(true);
    else setHeld(true);
    toast.success(call.done);
  }

  return (
    <Shell
      mode="demo"
      range={range}
      onRange={setRange}
      clockLabel={clock.label}
      garages={rows.map((g) => ({ id: g.id, name: g.name }))}
      openId={openId}
      onOpen={setOpenId}
    >
      {open ? (
        <GarageFloor garage={open} demo sent={sent} />
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {ranked.map((g) => (
            <GarageCard
              key={g.id}
              garage={g}
              range={range}
              windowName={clock.window}
              sent={sent}
              call={g.id === "tcp" ? call : null}
              acted={g.id === "tcp" ? acted : false}
              showWeek={range === "week" && g.id === "tcp"}
              onOpen={() => setOpenId(g.id)}
              onAct={act}
              onUndo={() => {
                if (call.action === "send") setSent(false);
                else if (call.action === "plan") setPlanned(false);
                else setHeld(false);
              }}
            />
          ))}
        </div>
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
      fact: {
        client: "RXR",
        kind: "Residential retrieval",
        scheduled: onFloor,
        showed: Object.entries(staff)
          .filter(([, on]) => on)
          .map(([name]) => (name === "you" ? "You" : name)),
        noCall: [],
        blocker: nested[0] ? `${nested[0].blockedBy} is in front of ${nested[0].plate}.` : null,
        claim: nested[0] ? "A car is boxed in." : "No open claim on this board.",
        redSince: null,
      },
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
      garages={[{ id: garage.id, name: garage.name }]}
      openId={openId}
      onOpen={setOpenId}
    >
      {openId ? (
        <GarageFloor garage={garage} />
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <GarageCard
            garage={garage}
            range={range}
            windowName={clock.window}
            sent={false}
            call={null}
            acted={false}
            showWeek={false}
            onOpen={() => setOpenId(garage.id)}
            onAct={() => {}}
            onUndo={() => {}}
          />
        </div>
      )}
    </Shell>
  );
}

function Shell({
  mode,
  range,
  onRange,
  clockLabel,
  garages,
  openId,
  onOpen,
  children,
}: {
  mode: SiteMode;
  range: RangeKey;
  onRange: (r: RangeKey) => void;
  clockLabel: string;
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
            {openId ? (
              <h1 className="font-display text-4xl">{garages.find((g) => g.id === openId)?.name}</h1>
            ) : (
              <>
                <h1 className="font-display text-4xl">{demo ? "Three garages." : "This login."}</h1>
                <p className="mt-1 max-w-xl text-sm text-muted">
                  {demo
                    ? `RXR New Rochelle · ${clockLabel}. Red is the miss. Open a card for the floor.`
                    : `New York ${clockLabel}. Two Clinton is the only live site.`}
                </p>
              </>
            )}
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

function situation(g: Scored, range: RangeKey, windowName: WindowKey, sent: boolean) {
  if (g.id === "tcp") {
    if (range === "week") return "Four misses. Two were the deck. Two were no-calls.";
    if (sent && windowName === "morning") return "Ana is counted. Still 18 min to the curb. The deck is still blocked.";
    if (windowName === "morning") return "45 cars at 8a. 3 of 5 showed. Ana is 2 minutes away. The deck is still blocked.";
    if (windowName === "evening") return "The 5p return fits. Residents are still waiting. The deck never cleared.";
    return "Lower deck blocked since 7:51a. This hour fits the crew. The curb does not.";
  }
  if (g.id === "one") {
    return sent ? "Ana is at Two Clinton. Sam and Priya still cover this garage." : "Covered. Ana can walk to Two Clinton in 2 minutes.";
  }
  if (g.id === "huguenot") return "Covered. Separate crew, 6 minutes away. Do not pull.";
  return g.fact.blocker ?? glance(g);
}

function aside(call: Call) {
  if (call.action === "send") return "Does not clear the deck or the 18-minute curb.";
  if (call.action === "plan") return "Fixes a no-call morning. Does not fix the deck.";
  return "A valet will not free the lower deck.";
}

function GarageCard({
  garage,
  range,
  windowName,
  sent,
  call,
  acted,
  showWeek,
  onOpen,
  onAct,
  onUndo,
}: {
  garage: Scored;
  range: RangeKey;
  windowName: WindowKey;
  sent: boolean;
  call: Call | null;
  acted: boolean;
  showWeek: boolean;
  onOpen: () => void;
  onAct: () => void;
  onUndo: () => void;
}) {
  const t = tone(garage.band);
  const clock = nyClock();
  const late = lateBy(garage.slice.retrievalP90, garage.sla);
  const floor = garage.id === "tcp" && garage.fact.noCall.length ? `${garage.valets} of ${garage.fact.scheduled}` : String(garage.valets);
  const label = call?.action === "send" ? "Send Ana over" : call?.action === "plan" ? "Set Ana for 7:30a" : "Hold park-downs";
  return (
    <article className={cn("flex flex-col rounded-2xl p-4", t.card)}>
      <button type="button" onClick={onOpen} className="text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-3xl leading-none">{garage.name}</p>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", t.chip)}>
            {garage.fact.redSince && garage.band !== "ok" ? redFor(garage.fact.redSince, clock.hour, clock.minute) : bandWord(garage.band)}
          </span>
        </div>
        <p className="mt-3 min-h-12 text-sm font-semibold">{situation(garage, range, windowName, sent)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
          <Metric label="Full" value={pct(garage.occupancy)} note={`${garage.slice.occupied} of ${garage.stalls}`} soft={t.soft} />
          <Metric
            label="To the curb"
            value={garage.slice.retrievalP90 ? `${garage.slice.retrievalP90} min` : "—"}
            note={garage.slice.retrievalP90 ? (late > 0 ? `${late} min late` : waitNote(garage.slice.retrievalP90, garage.sla)) : "No pulls yet"}
            soft={t.soft}
          />
          <Metric label="On the floor" value={floor} note={crewLine(garage, sent)} soft={t.soft} />
          <Metric
            label="Waiting"
            value={String(garage.slice.openTickets)}
            note={garage.fact.blocker ? "Deck blocked" : garage.fact.claim}
            soft={t.soft}
          />
        </dl>
      </button>
      {call ? (
        <div className="mt-4">
          <p className={cn("text-xs", t.soft)}>{acted ? "Still not fixed. Undo if that was the wrong call." : aside(call)}</p>
          <div className="mt-2">
            <Button variant={garage.band === "watch" ? "navy" : "gold"} size="sm" onClick={acted ? onUndo : onAct}>
              {acted ? "Undo" : label}
            </Button>
          </div>
          {showWeek ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {MORNINGS.map((m) => (
                <span key={m.day} className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", t.chip)}>
                  {m.day} {m.why}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function crewLine(g: Scored, sent: boolean) {
  if (g.id === "tcp" && g.fact.noCall.length) {
    const here = sent ? [...g.fact.showed, "Ana"] : g.fact.showed;
    return `${g.fact.scheduled} scheduled. ${here.join(", ")} here. ${g.fact.noCall.join(" and ")} no-called.`;
  }
  if (g.id === "one" && sent) return "Sam and Priya left. Ana is at Two Clinton.";
  if (!g.fact.showed.length) return "Nobody clocked in.";
  return `${g.fact.showed.join(", ")} on the floor.`;
}

function redFor(since: string, hour: number, minute: number) {
  const match = since.match(/(\d+):(\d+)(a|p)/);
  if (!match) return `since ${since}`;
  let startHour = Number(match[1]) % 12;
  if (match[3] === "p") startHour += 12;
  const elapsed = hour * 60 + minute - (startHour * 60 + Number(match[2]));
  if (elapsed < 0) return `since ${since}`;
  const h = Math.floor(elapsed / 60);
  const m = elapsed % 60;
  return h ? `Red for ${h}h ${m}m` : `Red for ${m}m`;
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

function GarageFloor({ garage, demo, sent = false }: { garage: Scored; demo?: boolean; sent?: boolean }) {
  const t = tone(garage.band);
  const nowLabel = nyClock().label;
  const [picked, setPicked] = useState(garage.hourly.some((row) => row.hour === nowLabel) ? nowLabel : "8a");
  const chart = garage.hourly.map((row) => ({ ...row, capacity: garage.capacity }));
  const hour = chart.find((row) => row.hour === picked) ?? chart[0];
  const gap = hour ? Math.max(0, hour.pulls - hour.capacity) : 0;
  const showWait = garage.slice.retrievalP90 > 0;

  return (
    <div className="mt-4">
      <section className={cn("rounded-2xl p-5", t.card)}>
        <p className={cn("text-sm", t.soft)}>
          {garage.fact.client} · {garage.fact.kind} · {garage.sla} min promise
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-4xl">{garage.name}</h2>
          <span className={cn("rounded-full px-3 py-1 text-xs font-bold", t.chip)}>{bandWord(garage.band)}</span>
        </div>
        <p className="mt-3 max-w-2xl text-lg font-semibold">{garage.fact.blocker ?? glance(garage)}</p>
        <p className={cn("mt-2 text-sm", t.soft)}>{crewLine(garage, sent)}</p>
        <p className={cn("mt-1 text-sm", t.soft)}>{garage.fact.claim}</p>
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
                ? `Short ${gap} cars this hour. Need ${Math.ceil(hour.pulls / CARS_PER_VALET_HR)} valets.${garage.fact.blocker ? " The deck is still blocked." : ""}`
                : garage.fact.blocker
                  ? "This hour fits. The deck is still blocked."
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
              <h3 className="font-display text-xl">Residents</h3>
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
