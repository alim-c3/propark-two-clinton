"use client";

import { createFileRoute } from "@tanstack/react-router";
import { enforceEvalNavigation } from "@/lib/eval/guard";
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
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AttendantBoard } from "@/components/attendant-board";
import { BuyProof } from "@/components/buy-proof";
import { Chrome } from "@/components/chrome";
import { DemoBar } from "@/components/demo-bar";
import { StreetCredBoard } from "@/components/street-cred";
import { GarageMap } from "@/components/garage-map";
import { KeyReturn } from "@/components/key-return";
import { Button } from "@/components/ui/button";
import { ValetChat } from "@/components/valet-chat";
import { HostStand } from "@/components/wait-list";
import { FINGERPRINTS, FORECAST, RESTACK } from "@/lib/seed";
import { useLane } from "@/lib/store";
import { cn, useNow } from "@/lib/utils";

export const Route = createFileRoute("/manager")({
  beforeLoad: () => enforceEvalNavigation("/manager"),
  component: Manager,
});

const CARS_PER_VALET_HR = 10;

function nyDay(offset = 0) {
  const d = new Date();
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  ny.setDate(ny.getDate() + offset);
  const weekday = ny.toLocaleDateString("en-US", { weekday: "short" });
  const month = ny.toLocaleDateString("en-US", { month: "short" });
  const date = ny.getDate();
  return {
    weekday,
    pill: offset === 0 ? `Today · ${weekday} ${date}` : `Tomorrow · ${weekday} ${date}`,
    banner: offset === 0 ? `TODAY · ${weekday.toUpperCase()} ${date} ${month.toUpperCase()}` : `TOMORROW · ${weekday.toUpperCase()} ${date} ${month.toUpperCase()}`,
  };
}

const TODAY = FORECAST;
const TOMORROW = [
  { hour: "2p", pulls: 5, actual: 0 },
  { hour: "3p", pulls: 7, actual: 0 },
  { hour: "4p", pulls: 11, actual: 0 },
  { hour: "5p", pulls: 15, actual: 0 },
  { hour: "6p", pulls: 13, actual: 0 },
  { hour: "7p", pulls: 6, actual: 0 },
  { hour: "8p", pulls: 3, actual: 0 },
  { hour: "9p", pulls: 2, actual: 0 },
  { hour: "6a", pulls: 9, actual: 0 },
  { hour: "7a", pulls: 24, actual: 0 },
  { hour: "8a", pulls: 48, actual: 0 },
  { hour: "9a", pulls: 18, actual: 0 },
];

function CarsPerHour() {
  const staff = useLane((s) => s.staff);
  const onFloor = Object.values(staff).filter(Boolean).length;
  const today = useMemo(() => nyDay(0), []);
  const tomorrow = useMemo(() => nyDay(1), []);
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [valets, setValets] = useState(Math.max(1, onFloor || 2));
  const [picked, setPicked] = useState("8a");

  const rows = useMemo(() => {
    const src = day === "today" ? TODAY : TOMORROW;
    const cap = valets * CARS_PER_VALET_HR;
    return src.map((r) => ({
      ...r,
      demand: r.pulls,
      done: r.actual,
      capacity: cap,
      gap: Math.max(0, r.pulls - cap),
    }));
  }, [day, valets]);

  const hour = rows.find((r) => r.hour === picked) ?? rows[0];
  const tight = hour.gap > 0;
  const wait = tight ? Math.max(4, Math.round((hour.gap / Math.max(1, valets)) * 6)) : 3;
  const stamp = day === "today" ? today : tomorrow;

  return (
    <section id="forecast" className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">CARS PER HOUR</p>
          <h2 className="font-display text-xl">Demand vs crew capacity</h2>
          <p className="mt-1 text-sm text-muted">
            8a is the wave — 45 today, 48 tomorrow. Line is {valets} valet{valets === 1 ? "" : "s"} × 10 cars/hr.
          </p>
        </div>
        <div className="flex gap-2">
          {([["today", today.pill], ["tomorrow", tomorrow.pill]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setDay(k)} className={cn("rounded-full px-3 py-1 text-xs font-bold", day === k ? "bg-navy text-cream" : "bg-line text-navy")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-navy" htmlFor="valet-count">Valets on the floor</label>
        <input id="valet-count" type="range" min={1} max={6} value={valets} onChange={(e) => setValets(Number(e.target.value))} className="w-40 accent-[var(--color-gold)]" />
        <span className="font-display text-2xl tabular-nums text-navy">{valets}</span>
        <span className="text-sm text-muted">{valets * CARS_PER_VALET_HR} cars/hr capacity</span>
      </div>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} onClick={(state) => {
            const label = (state as { activeLabel?: string } | undefined)?.activeLabel;
            if (label) setPicked(label);
          }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
            <Tooltip formatter={(value, name) => [value as number, name === "demand" ? "Forecast pulls" : name === "done" ? "Already staged" : "Crew capacity"]} />
            <Bar dataKey="demand" name="demand" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="done" name="done" fill="var(--color-navy)" radius={[6, 6, 0, 0]} />
            <Line type="monotone" dataKey="capacity" name="capacity" stroke="var(--color-ok, #1f6b4a)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {rows.map((r) => (
          <button key={r.hour} type="button" onClick={() => setPicked(r.hour)} className={cn("rounded-full px-2.5 py-1 text-xs font-bold tabular-nums", picked === r.hour ? "bg-gold text-navy" : r.gap ? "bg-navy/10 text-navy" : "bg-line text-muted")}>
            {r.hour}
          </button>
        ))}
      </div>
      <div className={cn("mt-4 rounded-xl p-4", tight ? "bg-gold/20 text-navy" : "bg-navy text-cream")}>
        <p className="text-[10px] font-bold tracking-[0.16em]">{stamp.banner} · {hour.hour}</p>
        <p className="mt-1 font-display text-2xl">{hour.demand} pulls vs {hour.capacity} capacity</p>
        <p className="mt-1 text-sm opacity-80">
          {tight
            ? `Short ${hour.gap} cars. Typical wait ~${wait} min. Need ${Math.ceil(hour.demand / CARS_PER_VALET_HR)} valets for this hour.`
            : `Covered. Wait stays around ${wait} min if the floor holds at ${valets}.`}
        </p>
      </div>
    </section>
  );
}

const STAFF_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function hourNum(label: string) {
  const n = parseInt(label, 10);
  if (label.endsWith("p") && n !== 12) return n + 12;
  if (label.endsWith("a") && n === 12) return 0;
  return n;
}

function nyHour(now: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

function staffWord(n: number) {
  return STAFF_WORDS[n] ?? String(n);
}

function backWithinHour(note: string, now: number) {
  const label = note.split("Expected back:")[1] ?? "";
  if (/tomorrow|more than/i.test(label)) return false;
  const match = label.match(/(\d+)\s*(am|pm)/i);
  if (!match) return false;
  let hour = Number(match[1]) % 12;
  if (/pm/i.test(match[2])) hour += 12;
  const start = new Date(now);
  start.setHours(hour, 0, 0, 0);
  if (start.getTime() < now - 30 * 60000) start.setDate(start.getDate() + 1);
  return start.getTime() <= now + 60 * 60000 && start.getTime() >= now - 15 * 60000;
}

function Manager() {
  const tickets = useLane((s) => s.tickets);
  const staff = useLane((s) => s.staff);
  const restack = useLane((s) => s.restack);
  const acceptRestack = useLane((s) => s.acceptRestack);
  const dismissRestack = useLane((s) => s.dismissRestack);
  const now = useNow();
  const [foundStall, setFoundStall] = useState<string | undefined>();

  const live = tickets.filter((t) => t.status !== "cancelled" && t.status !== "released");
  const onFloor = Object.values(staff).filter(Boolean).length;
  const nested = live.filter((t) => t.blockedBy);
  const waiting = live.filter((t) => t.type === "now" && t.status === "open");
  const inbound = live.filter((t) => t.type === "arrival");
  const pendingMoves = RESTACK.filter((r) => restack[r.id] === "pending");
  const requestsNow = live.filter(
    (t) => (t.type === "now" || t.type === "scheduled") && (t.status === "open" || t.status === "claimed"),
  );
  const oldestRequest = requestsNow.reduce((min, t) => Math.min(min, t.requestedAt), Number.POSITIVE_INFINITY);
  const putBacks = live.filter((t) => t.type === "arrival" && (t.status === "open" || t.status === "claimed"));
  const oldestPutBack = putBacks.reduce((min, t) => Math.min(min, t.requestedAt), Number.POSITIVE_INFINITY);
  const putBackForecast = tickets.filter((t) => /Expected back:/i.test(t.note) && backWithinHour(t.note, now)).length;
  const curbSamples = tickets
    .filter((t) => (t.type === "now" || t.type === "scheduled") && t.stagedAt)
    .map((t) => Math.max(1, Math.round((t.stagedAt! - t.requestedAt) / 60000)));
  const openWaits = requestsNow.map((t) => Math.max(0, Math.round((now - t.requestedAt) / 60000)));
  const slaAvg = curbSamples.length
    ? Math.round(curbSamples.reduce((a, b) => a + b, 0) / curbSamples.length)
    : openWaits.length
      ? Math.round(openWaits.reduce((a, b) => a + b, 0) / openWaits.length)
      : 0;
  const longest = Math.max(0, ...curbSamples, ...openWaits);
  const slaOver = slaAvg > 10;
  const clock = nyHour(now);
  const upcoming = FORECAST.filter((r) => hourNum(r.hour) > clock);
  const peak = (upcoming.length ? upcoming : FORECAST).reduce((best, row) => (row.pulls > best.pulls ? row : best));
  const required = Math.ceil(peak.pulls / CARS_PER_VALET_HR);
  const short = required > onFloor;
  const nextHour = (clock + 1) % 24;
  const pace = FORECAST.find((r) => hourNum(r.hour) === nextHour)?.pulls
    ?? FORECAST.find((r) => hourNum(r.hour) === clock)?.pulls
    ?? peak.pulls;
  const scheduledSoon = live.filter((t) => t.type === "scheduled" && t.status === "open").length;
  const forecast60 = Math.max(pace, scheduledSoon);
  const capacity = Math.max(1, onFloor) * CARS_PER_VALET_HR;
  const openRequests = live.filter((t) => t.type === "now" && t.status !== "staged" && t.status !== "released").length;

  function seeForecast() {
    document.getElementById("forecast")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const stats: Array<{ k: string; v: string; s: string; tone?: "ok" | "danger" }> = [
    ["ON THE FLOOR", String(onFloor), "Luis · Derrick · you if clocked"],
    ["NEST NAMED", String(nested.length), nested[0] ? `${nested[0].blockedBy} in front of ${nested[0].plate}` : "Clear"],
    ["IN LINE", String(waiting.length), inbound.length ? `+ ${inbound.length} inbound` : "Now-requests"],
    ["REQUESTS NOW", String(requestsNow.length), Number.isFinite(oldestRequest) ? `Oldest waiting ${Math.max(0, Math.round((now - oldestRequest) / 60000))} min` : "None waiting"],
    ["FORECAST, NEXT 60 MIN", String(forecast60), `capacity ${capacity}/hr`],
    ["PUT-BACKS NOW", String(putBacks.length), Number.isFinite(oldestPutBack) ? `Oldest waiting ${Math.max(0, Math.round((now - oldestPutBack) / 60000))} min` : "None waiting"],
    ["PUT-BACKS, NEXT 60 MIN", String(putBackForecast), "From expected-back answers"],
    ["SLA TO CURB", `${slaAvg} min`, `target 10 min · longest ${longest} min`, slaOver ? "danger" : "ok"],
  ].map((row) => ({ k: row[0], v: row[1], s: row[2], tone: row[3] as "ok" | "danger" | undefined }));

  return (
    <div className="min-h-screen bg-cream">
      <Chrome />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <DemoBar />
        <div className="mt-4 overflow-hidden rounded-2xl bg-navy text-cream">
          <div className="grid md:grid-cols-2">
            <div className="p-6">
              <p className="text-[10px] font-bold tracking-[0.18em] text-gold">CONTROL TOWER INSIGHT</p>
              <h1 className="mt-2 font-display text-3xl">
                {short ? `Will the ${parseInt(peak.hour, 10)}:00 wave get off the ground?` : "Next hour is covered"}
              </h1>
              <p className="mt-2 max-w-md text-sm text-cream/70">
                {short
                  ? `${onFloor} valets on the floor. ${peak.pulls} pulls at ${peak.hour}. ${staffWord(required)[0].toUpperCase()}${staffWord(required).slice(1)} valets clear the wave.`
                  : `${onFloor} valets cover ${peak.pulls} pulls at ${peak.hour}. Capacity is ${capacity} cars an hour.`}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["VALETS", String(onFloor)],
                  ["OPEN NOW", String(openRequests)],
                  ["SLA", `${slaAvg} min`],
                  ["PEAK", `${peak.pulls} vs ${capacity}`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] font-bold tracking-[0.14em] text-gold">{k}</p>
                    <p className="font-display text-2xl tabular-nums">{v}</p>
                  </div>
                ))}
              </div>
              {short ? (
                <Button className="mt-4 uppercase" variant="gold" onClick={seeForecast}>
                  Staff {staffWord(required)} before {peak.hour}
                </Button>
              ) : (
                <button type="button" className="mt-4 text-sm text-cream/70 underline" onClick={seeForecast}>
                  See today’s forecast
                </button>
              )}
            </div>
            <img src="/flow-manager.jpg" alt="Ops desk overlooking Two Clinton Park" className="h-48 w-full object-cover object-center md:h-full" />
          </div>
        </div>
        <div className="mt-4"><CarsPerHour /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((tile) => (
            <div key={tile.k} className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">{tile.k}</p>
              <p className={cn("font-display text-3xl tabular-nums", tile.tone === "danger" ? "text-danger" : tile.tone === "ok" ? "text-ok" : "text-navy")}>{tile.v}</p>
              <p className="text-xs text-muted">{tile.s}</p>
            </div>
          ))}
        </div>
        <div className="mt-4"><AttendantBoard /></div>
        <div className="mt-4">
          <GarageMap prominent hidePlates highlight={foundStall} onSelectStall={setFoundStall} />
        </div>
        <div className="mt-4"><KeyReturn tone="light" prominent /></div>
        <div className="mt-4"><BuyProof /></div>
        <div className="mt-4"><HostStand tickets={tickets} staff={staff} /></div>
        <div className="mt-4"><GarageMap hideSearch highlight={foundStall ?? waiting[0]?.stall ?? nested[0]?.stall ?? "A-01"} /></div>

        <section className="mt-4 rounded-2xl border border-line bg-white p-4">
          <h2 className="font-display text-xl">Tonight’s restack</h2>
          <p className="mt-1 text-sm text-muted">Accept puts it on the valet board. Leave it stays put.</p>
          <div className="mt-4 flex flex-col gap-3">
            {RESTACK.map((r) => {
              const st = restack[r.id];
              return (
                <article key={r.id} className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.car} · {r.unit} · {r.plate}</p>
                    <p className="text-sm text-muted">{r.from} → {r.to}</p>
                    <p className="mt-1 text-sm text-muted">{r.why}</p>
                  </div>
                  {st === "accepted" ? (
                    <p className="text-sm font-semibold text-ok">Queued tonight</p>
                  ) : st === "dismissed" ? (
                    <p className="text-sm text-muted">Left in place</p>
                  ) : (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="navy" size="sm" onClick={() => { const res = acceptRestack(r.id); toast[res.ok ? "success" : "error"](res.message); }}>Accept</Button>
                      <Button variant="ghost" size="sm" onClick={() => { const res = dismissRestack(r.id); toast[res.ok ? "success" : "error"](res.message); }}>Leave it</Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {!pendingMoves.length ? <p className="mt-3 text-sm text-muted">No pending moves.</p> : null}
        </section>

        <div className="mt-4"><StreetCredBoard /></div>

        <section className="mt-4 rounded-2xl border border-line bg-white p-4">
          <h2 className="font-display text-xl">Who leaves when — sample 14 days</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FINGERPRINTS.map((r) => (
              <article key={r.unit} className="rounded-xl border border-line p-4">
                <p className="font-semibold">{r.unit}</p>
                <p className="text-sm text-muted">{r.car}</p>
                <p className="mt-2 text-sm">Out {r.leave} · back {r.back}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${r.hit}%` }} />
                </div>
                <p className="mt-1 text-xs tabular-nums text-muted">{r.hit ? `${r.hit}% hit rate` : "Charge-gated"}</p>
                <p className="mt-2 text-sm text-navy">{r.note}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-4"><ValetChat tone="light" /></div>
      </div>
    </div>
  );
}
