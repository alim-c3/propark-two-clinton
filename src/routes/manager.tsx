"use client";

import { createFileRoute } from "@tanstack/react-router";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/manager")({ component: Manager });

const WEEKDAY = FORECAST;
const SATURDAY = [
  { hour: "2p", pulls: 4, actual: 3 },
  { hour: "3p", pulls: 6, actual: 5 },
  { hour: "4p", pulls: 7, actual: 6 },
  { hour: "5p", pulls: 5, actual: 4 },
  { hour: "6p", pulls: 4, actual: 3 },
  { hour: "7p", pulls: 5, actual: 0 },
  { hour: "8p", pulls: 6, actual: 0 },
  { hour: "9p", pulls: 4, actual: 0 },
  { hour: "6a", pulls: 1, actual: 0 },
  { hour: "7a", pulls: 2, actual: 0 },
  { hour: "8a", pulls: 3, actual: 0 },
  { hour: "9a", pulls: 4, actual: 0 },
];

function CarsPerHour() {
  const staff = useLane((s) => s.staff);
  const onFloor = Object.values(staff).filter(Boolean).length;
  const [day, setDay] = useState<"weekday" | "saturday">("weekday");
  const [valets, setValets] = useState(Math.max(1, onFloor || 2));
  const [picked, setPicked] = useState("7a");

  const rows = useMemo(() => {
    const src = day === "weekday" ? WEEKDAY : SATURDAY;
    const cap = valets * 4;
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

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
            CARS PER HOUR
          </p>
          <h2 className="font-display text-xl">Demand vs crew capacity</h2>
          <p className="mt-1 text-sm text-muted">
            Gold is forecast pulls. Navy ticks are already staged. Line is what
            {` ${valets} valet${valets === 1 ? "" : "s"} can clear (~4 cars/hr each).`}
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ["weekday", "Weekday"],
              ["saturday", "Saturday"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setDay(k)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold",
                day === k ? "bg-navy text-cream" : "bg-line text-navy",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-navy" htmlFor="valet-count">
          Valets on the floor
        </label>
        <input
          id="valet-count"
          type="range"
          min={1}
          max={4}
          value={valets}
          onChange={(e) => setValets(Number(e.target.value))}
          className="w-40 accent-[var(--color-gold)]"
        />
        <span className="font-display text-2xl tabular-nums text-navy">{valets}</span>
        <span className="text-sm text-muted">{valets * 4} cars/hr capacity</span>
      </div>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            onClick={(state) => {
              const label = (state as { activeLabel?: string } | undefined)?.activeLabel;
              if (label) setPicked(label);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
            <Tooltip
              formatter={(value, name) => [
                value as number,
                name === "demand"
                  ? "Forecast pulls"
                  : name === "done"
                    ? "Already staged"
                    : "Crew capacity",
              ]}
            />
            <Bar dataKey="demand" name="demand" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="done" name="done" fill="var(--color-navy)" radius={[6, 6, 0, 0]} />
            <Line
              type="monotone"
              dataKey="capacity"
              name="capacity"
              stroke="var(--color-ok, #1f6b4a)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {rows.map((r) => (
          <button
            key={r.hour}
            type="button"
            onClick={() => setPicked(r.hour)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
              picked === r.hour
                ? "bg-gold text-navy"
                : r.gap
                  ? "bg-navy/10 text-navy"
                  : "bg-line text-muted",
            )}
          >
            {r.hour}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "mt-4 rounded-xl p-4",
          tight ? "bg-gold/20 text-navy" : "bg-navy text-cream",
        )}
      >
        <p className="text-[10px] font-bold tracking-[0.16em]">
          {day === "weekday" ? "WEEKDAY" : "SATURDAY"} · {hour.hour}
        </p>
        <p className="mt-1 font-display text-2xl">
          {hour.demand} pulls vs {hour.capacity} capacity
        </p>
        <p className="mt-1 text-sm opacity-80">
          {tight
            ? `Short ${hour.gap} cars. Typical wait ~${wait} min. Call a valet before this hour.`
            : `Covered. Wait stays around ${wait} min if the floor holds at ${valets}.`}
        </p>
      </div>
    </section>
  );
}

function Manager() {
  const tickets = useLane((s) => s.tickets);
  const staff = useLane((s) => s.staff);
  const restack = useLane((s) => s.restack);
  const acceptRestack = useLane((s) => s.acceptRestack);
  const dismissRestack = useLane((s) => s.dismissRestack);
  const [more, setMore] = useState(false);

  const live = tickets.filter(
    (t) => t.status !== "cancelled" && t.status !== "released",
  );
  const onFloor = Object.values(staff).filter(Boolean).length;
  const nested = live.filter((t) => t.blockedBy);
  const waiting = live.filter((t) => t.type === "now" && t.status === "open");
  const inbound = live.filter((t) => t.type === "arrival");
  const coverage = onFloor >= 3 ? "covered" : "tight";
  const pendingMoves = RESTACK.filter((r) => restack[r.id] === "pending");

  return (
    <div className="min-h-screen bg-cream">
      <Chrome />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <DemoBar />
        <div className="mt-4 overflow-hidden rounded-2xl bg-navy text-cream">
          <div className="grid md:grid-cols-2">
            <div className="p-6">
              <p className="text-[10px] font-bold tracking-[0.18em] text-gold">
                TOWER · PROPARK RUNWAY
              </p>
              <h1 className="mt-2 font-display text-3xl">
                Will the 7:05 get off the ground?
              </h1>
              <p className="mt-2 max-w-md text-sm text-cream/70">
                {onFloor} valets on the floor. Coverage is {coverage}. Live
                retrieves: {waiting.length} in line
                {nested.length ? ` · ${nested.length} nested` : ""}.
              </p>
              <p
                className={cn(
                  "mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
                  coverage === "tight"
                    ? "bg-gold text-navy"
                    : "bg-ok text-cream",
                )}
              >
                {coverage === "tight"
                  ? "Call a third valet before the wave"
                  : "Shift is covered"}
              </p>
            </div>
            <img
              src="/flow-manager.jpg"
              alt="Ops desk overlooking Two Clinton Park"
              className="h-48 w-full object-cover object-center md:h-full"
            />
          </div>
        </div>

        <div className="mt-4">
          <BuyProof />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["ON THE FLOOR", String(onFloor), "Luis · Derrick · you if clocked"],
            ["NEST NAMED", String(nested.length), nested[0] ? `${nested[0].blockedBy} in front of ${nested[0].plate}` : "Clear"],
            ["IN LINE", String(waiting.length), inbound.length ? `+ ${inbound.length} inbound` : "Now-requests"],
          ].map(([k, v, s]) => (
            <div key={k} className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
                {k}
              </p>
              <p className="font-display text-3xl tabular-nums text-navy">{v}</p>
              <p className="text-xs text-muted">{s}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <CarsPerHour />
        </div>

        <div className="mt-4">
          <AttendantBoard />
        </div>

        <div className="mt-4">
          <HostStand tickets={tickets} staff={staff} />
        </div>

        <div className="mt-4">
          <GarageMap highlight={waiting[0]?.stall ?? nested[0]?.stall ?? "A-01"} />
        </div>

        <button
          type="button"
          className="mt-6 text-sm font-semibold text-gold-2"
          onClick={() => setMore((v) => !v)}
        >
          {more ? "Hide the rest of the board" : "More — restack, crew, fingerprints"}
        </button>

        {more ? (
          <div className="mt-4 space-y-4">
            <section className="rounded-2xl border border-line bg-white p-4">
              <h2 className="font-display text-xl">Tonight’s restack</h2>
              <p className="mt-1 text-sm text-muted">
                Accept puts it on the valet board. Leave it stays put.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {RESTACK.map((r) => {
                  const st = restack[r.id];
                  return (
                    <article
                      key={r.id}
                      className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {r.car} · {r.unit} · {r.plate}
                        </p>
                        <p className="text-sm text-muted">
                          {r.from} → {r.to}
                        </p>
                        <p className="mt-1 text-sm text-muted">{r.why}</p>
                      </div>
                      {st === "accepted" ? (
                        <p className="text-sm font-semibold text-ok">Queued tonight</p>
                      ) : st === "dismissed" ? (
                        <p className="text-sm text-muted">Left in place</p>
                      ) : (
                        <div className="flex shrink-0 gap-2">
                          <Button
                            variant="navy"
                            size="sm"
                            onClick={() => {
                              const res = acceptRestack(r.id);
                              toast[res.ok ? "success" : "error"](res.message);
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const res = dismissRestack(r.id);
                              toast[res.ok ? "success" : "error"](res.message);
                            }}
                          >
                            Leave it
                          </Button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {!pendingMoves.length ? (
                <p className="mt-3 text-sm text-muted">No pending moves.</p>
              ) : null}
            </section>

            <StreetCredBoard />

            <section className="rounded-2xl border border-line bg-white p-4">
              <h2 className="font-display text-xl">Who leaves when — sample 14 days</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FINGERPRINTS.map((r) => (
                  <article key={r.unit} className="rounded-xl border border-line p-4">
                    <p className="font-semibold">{r.unit}</p>
                    <p className="text-sm text-muted">{r.car}</p>
                    <p className="mt-2 text-sm">
                      Out {r.leave} · back {r.back}
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{ width: `${r.hit}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-muted">
                      {r.hit ? `${r.hit}% hit rate` : "Charge-gated"}
                    </p>
                    <p className="mt-2 text-sm text-navy">{r.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <KeyReturn tone="light" />
              <ValetChat tone="light" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
