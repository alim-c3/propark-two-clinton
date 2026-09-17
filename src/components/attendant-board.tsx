"use client";

import { rollupAttendant, rollupFloor, type AttendantRollup, type FloorStatus } from "@/lib/attendants";
import { useLane } from "@/lib/store";
import { clockLabel, cn, useNow } from "@/lib/utils";

function dur(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function statusCopy(s: FloorStatus) {
  if (s === "on") return "On the runway";
  if (s === "break") return "On break";
  return "Off";
}

function Stat({
  k,
  v,
  dark,
}: {
  k: string;
  v: string;
  dark?: boolean;
}) {
  return (
    <div>
      <p className={cn("text-[10px] font-bold tracking-[0.14em]", dark ? "text-cream/50" : "text-muted")}>
        {k}
      </p>
      <p className="font-display text-2xl tabular-nums">{v}</p>
    </div>
  );
}

export function AttendantCard({
  row,
  tone = "light",
  compact,
}: {
  row: AttendantRollup;
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  const dark = tone === "dark";
  const shown = compact ? row.pulls.slice(0, 3) : row.pulls.slice(0, 6);
  return (
    <article
      className={cn(
        "rounded-2xl border p-4",
        dark ? "border-navy-2 bg-navy-2/40 text-cream" : "border-line bg-white text-navy",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
            {statusCopy(row.status).toUpperCase()}
          </p>
          <h3 className="mt-1 font-display text-2xl">{row.id}</h3>
          <p className={cn("text-xs", dark ? "text-cream/60" : "text-muted")}>{row.desk}</p>
        </div>
        <p
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold tabular-nums",
            row.status === "on" && "bg-ok text-cream",
            row.status === "break" && "bg-gold text-navy",
            row.status === "off" && (dark ? "bg-navy text-cream/60" : "bg-line text-muted"),
          )}
        >
          {row.clockIn
            ? row.clockOut
              ? `${clockLabel(row.clockIn)}–${clockLabel(row.clockOut)}`
              : `since ${clockLabel(row.clockIn)}`
            : "Not on"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat k="CARS" v={String(row.cars)} dark={dark} />
        <Stat k="PER HOUR" v={row.cph == null ? "—" : String(row.cph)} dark={dark} />
        <Stat k="BREAK" v={dur(row.breakMin)} dark={dark} />
      </div>

      <p className={cn("mt-3 text-xs", dark ? "text-cream/60" : "text-muted")}>
        On duty {dur(row.onMin)}
        {row.avgMin != null ? ` · avg ${row.avgMin} min to curb` : ""}
        {row.longest != null ? ` · longest ${row.longest} min` : ""}
        {row.nests ? ` · ${row.nests} nest${row.nests === 1 ? "" : "s"}` : ""}
      </p>

      {row.current ? (
        <p className="mt-3 rounded-xl bg-gold px-3 py-2 text-sm text-navy">
          Now · {row.current.car} · {row.current.plate} · {row.current.stall}
        </p>
      ) : null}

      {row.hours.length && !compact ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {row.hours.map((h) => (
            <span
              key={h.hour}
              className={cn(
                "rounded-full px-2 py-1 text-[10px] font-semibold tabular-nums",
                dark ? "bg-navy text-cream/80" : "bg-cream text-navy",
              )}
            >
              {h.hour} · {h.n}
            </span>
          ))}
        </div>
      ) : null}

      {shown.length ? (
        <ul className="mt-3 space-y-1">
          {shown.map((p) => (
            <li
              key={`${p.plate}-${p.at}`}
              className={cn(
                "flex items-baseline justify-between gap-2 text-sm",
                dark ? "text-cream/85" : "text-navy",
              )}
            >
              <span className="min-w-0 truncate">
                {p.car} · {p.plate}
                <span className={cn("ml-1 text-xs", dark ? "text-cream/50" : "text-muted")}>
                  {p.stall}
                  {p.nest ? " · nest" : ""}
                </span>
              </span>
              <span className={cn("shrink-0 tabular-nums text-xs", dark ? "text-cream/50" : "text-muted")}>
                {clockLabel(p.at)} · {p.mins}m
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn("mt-3 text-sm", dark ? "text-cream/60" : "text-muted")}>
          No handoffs yet this shift.
        </p>
      )}
    </article>
  );
}

export function AttendantBoard() {
  const tickets = useLane((s) => s.tickets);
  const punches = useLane((s) => s.punches);
  const pulls = useLane((s) => s.pulls);
  const now = useNow();
  const rows = rollupFloor(punches, pulls, tickets, now || Date.now());
  return (
    <section>
      <h2 className="font-display text-xl text-navy">The floor — today</h2>
      <p className="mt-1 text-sm text-muted">
        Cars handed off, pace, and break time. Cars per hour uses on-duty minutes only —
        breaks don’t count.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <AttendantCard key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

export function YourShift({ tone = "dark" }: { tone?: "light" | "dark" }) {
  const tickets = useLane((s) => s.tickets);
  const punches = useLane((s) => s.punches);
  const pulls = useLane((s) => s.pulls);
  const now = useNow();
  const row = rollupAttendant("You", punches, pulls, tickets, now || Date.now());
  return <AttendantCard row={row} tone={tone} compact />;
}
