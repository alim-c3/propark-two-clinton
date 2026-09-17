"use client";

import { type ReactNode } from "react";
import {
  joinPreview,
  ordinal,
  placeLine,
  readyNow,
  withPlaces,
  type QueueItem,
} from "@/lib/queue";
import { CONTACTS, residentOf, STALLS, stallDeck } from "@/lib/seed";
import { useLane } from "@/lib/store";
import { scoreMap, scoreOf } from "@/lib/cred";
import type { Ticket } from "@/lib/types";
import { cn, useNow } from "@/lib/utils";

function onDuty(staff: Record<string, boolean>) {
  return Object.values(staff).filter(Boolean).length;
}

function LiveDot({ tone = "gold" }: { tone?: "gold" | "navy" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "live-dot size-2 shrink-0 rounded-full",
        tone === "navy" ? "bg-navy" : "bg-gold",
      )}
    />
  );
}

function stillLabel(mins: number) {
  return mins <= 1 ? "still ~1 min" : `still ${mins} min`;
}

function stallHint(id: string) {
  const row = id.charAt(0);
  if (row === "R") return "P2 guest row, by the ramp";
  if (row === "A") return "P2 hot aisle · A-row";
  if (row === "B") return "P2 · B-row";
  if (row === "C") return "P2 EV wall · C-row";
  if (row === "P") return "P2 permit stalls";
  return "P2";
}

function StallWhere({
  stall,
  nested,
  pulling,
}: {
  stall: string;
  nested?: string;
  pulling?: boolean;
}) {
  return (
    <div className="mt-3 rounded-xl bg-cream px-3 py-3 text-navy">
      <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
        {pulling ? "THEY’RE PULLING IT FROM" : "YOUR STALL"}
      </p>
      <p className="font-display text-3xl">{stall}</p>
      <p className="mt-1 text-sm text-muted">
        {stallHint(stall)}.
        {pulling
          ? " Stay upstairs — we’ll text when it’s at the curb."
          : " Grab a phone or a bag from the car anytime."}
        {nested && !pulling
          ? ` Nested behind ${nested} — ask the desk if you can’t reach it.`
          : ""}
      </p>
    </div>
  );
}

function WaitRow({
  q,
  you,
  dark,
}: {
  q: QueueItem;
  you?: boolean;
  dark?: boolean;
}) {
  const nest = q.ticket.blockedBy ? ` · nest ${q.ticket.blockedBy}` : "";
  const deck = stallDeck(q.ticket.stall)?.liftDeck;
  const lift =
    deck === "upper" ? " · ↑ upper" : deck === "lower" ? " · ↓ lower" : "";
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-3",
        you ? "bg-gold text-navy" : dark ? "bg-navy text-cream" : "bg-cream text-navy",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg font-display text-xl tabular-nums",
          you ? "bg-navy text-gold" : "bg-gold text-navy",
        )}
      >
        {q.place}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {q.ticket.car} · {q.ticket.color}
        </p>
        <p
          className={cn(
            "truncate text-xs",
            you ? "text-navy/70" : dark ? "text-cream/55" : "text-muted",
          )}
        >
          {q.ticket.plate} · APT {q.ticket.unit}
          {lift}
        </p>
        <p className={cn("text-xs", you ? "text-navy/70" : dark ? "text-cream/60" : "text-muted")}>
          {q.ticket.status === "claimed"
            ? `${q.ticket.valet ?? "A valet"} pulling`
            : "Waiting"}
          {nest}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-right text-xs font-semibold tabular-nums",
          you ? "text-navy" : dark ? "text-gold" : "text-gold-2",
        )}
      >
        {stillLabel(q.stillMin)}
      </p>
    </li>
  );
}

export function CurbPager({
  tickets,
  staff,
  mine,
  nested,
  children,
}: {
  tickets: Ticket[];
  staff: Record<string, boolean>;
  mine?: Ticket;
  nested?: boolean;
  children?: ReactNode;
}) {
  const now = useNow();
  const floor = onDuty(staff);
  const cred = useLane((s) => s.cred);
  const activeUnit = useLane((s) => s.activeUnit);
  const parked = residentOf(activeUnit);
  const scores = scoreMap(
    cred,
    CONTACTS.map((c) => c.unit),
  );
  const line = withPlaces(tickets, floor, now, scores);
  const ready = mine && mine.status === "staged";
  const spot = mine ? line.find((q) => q.ticket.id === mine.id) : undefined;
  const preview = joinPreview(
    tickets,
    floor,
    Boolean(nested),
    now,
    mine ? scoreOf(cred, mine.unit) : scoreOf(cred, parked.unit),
  );
  const stallId =
    mine && mine.stall && mine.stall !== "curb" ? mine.stall : parked.stall;
  const nest =
    mine?.blockedBy ?? STALLS.find((s) => s.id === stallId)?.blockedBy;

  if (ready) {
    return (
      <section className="mt-4 rounded-2xl border border-gold bg-gold px-4 py-5 text-navy">
        <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em]">
          <LiveDot tone="navy" />
          AT THE CURB
        </p>
        <p className="mt-1 font-display text-3xl">Your car is ready on the runway.</p>
        <p className="mt-1 text-sm">
          The garage already knew you wanted it. Clinton Place — come down when
          you’re ready.
        </p>
      </section>
    );
  }

  if (spot && mine) {
    const pulling = mine.status === "claimed";
    return (
      <section className="mt-4 rounded-2xl border border-gold bg-navy px-4 py-5 text-cream">
        <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-gold">
          <LiveDot />
          {pulling ? "WE’RE GETTING YOUR CAR" : "YOUR PLACE"}
        </p>
        <p className="mt-2 font-display text-3xl tabular-nums text-gold sm:text-4xl">
          {pulling
            ? "A valet has it"
            : spot.stillMin <= 1
              ? "About a minute"
              : `${spot.stillMin} min`}
        </p>
        <p className="mt-1 text-sm text-cream/70">
          {pulling
            ? "We’ll ping you when it’s ready on the runway."
            : `${placeLine(spot.place)}${
                spot.place > 1
                  ? ` · ${spot.place - 1} car${spot.place - 1 === 1 ? "" : "s"} ahead`
                  : ""
              }`}
        </p>
        <StallWhere stall={stallId} nested={nest} pulling={pulling} />
      </section>
    );
  }

  return (
    <>
      <section className="mt-4 rounded-2xl border border-line bg-white px-4 py-4">
        <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-gold-2">
          <LiveDot />
          YOUR CAR
        </p>
        <p className="mt-2 font-display text-3xl text-navy">Parked in {parked.stall}</p>
        <p className="mt-1 text-sm text-muted">
          {stallHint(parked.stall)}. Grab a phone or a bag from the car anytime.
          {nest ? ` Nested behind ${nest} — ask the desk if you can’t reach it.` : ""}
        </p>
      </section>
      <section className="mt-4 rounded-2xl border border-gold bg-navy px-4 py-5 text-cream">
        <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-gold">
          <LiveDot />
          IF YOU ASK NOW
        </p>
        <p className="mt-2 font-display text-3xl text-gold sm:text-4xl">
          {line.length ? placeLine(preview.place) : "You’re next in line"}
        </p>
        <p className="mt-1 font-display text-2xl tabular-nums">
          {line.length
            ? preview.stillMin <= 1
              ? "about a minute"
              : `${preview.stillMin} min`
            : "about 5 min"}
        </p>
        {children ? <div className="mt-4">{children}</div> : null}
      </section>
    </>
  );
}

export function HostStand({
  tickets,
  staff,
  tone = "light",
}: {
  tickets: Ticket[];
  staff: Record<string, boolean>;
  tone?: "light" | "dark";
}) {
  const now = useNow();
  const floor = onDuty(staff);
  const cred = useLane((s) => s.cred);
  const scores = scoreMap(
    cred,
    CONTACTS.map((c) => c.unit),
  );
  const line = withPlaces(tickets, floor, now, scores);
  const ready = readyNow(tickets);
  const dark = tone === "dark";
  const pulling = line.filter((q) => q.ticket.status === "claimed").length;

  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        dark
          ? "border-navy-2 bg-navy-2 text-cream"
          : "border-line bg-white text-navy",
      )}
    >
      <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-gold">
        <LiveDot />
        HOST STAND · CARS COMING
      </p>
      <p className={cn("mt-1 text-xs", dark ? "text-cream/60" : "text-muted")}>
        Oldest now-request first. Claimed cars stay at the top until they hit the
        curb.
      </p>
      <p
        className={cn(
          "mt-2 text-sm font-semibold",
          dark ? "text-cream" : "text-navy",
        )}
      >
        {line.length
          ? `${line.length} in queue${pulling ? ` · ${pulling} pulling` : ""}${
              ready.length ? ` · ${ready.length} at curb` : ""
            }`
          : ready.length
            ? `${ready.length} at the curb · line is empty`
            : "Line is empty"}
      </p>

      {ready.length ? (
        <ol className="mt-3 space-y-2">
          {ready.map((t) => (
              <li
                key={t.id}
                className="rounded-xl bg-gold px-3 py-3 text-navy"
              >
                <p className="text-[10px] font-bold tracking-[0.14em]">
                  NOW SERVING · CLINTON PLACE
                </p>
                <p className="font-semibold">
                  {t.car} · {t.color}
                </p>
                <p className="text-xs">
                  {t.plate} · APT {t.unit}
                </p>
              </li>
          ))}
        </ol>
      ) : null}

      {line.length ? (
        <ol className="mt-3 space-y-2">
          {line.map((q) => (
            <WaitRow key={q.ticket.id} q={q} dark={dark} />
          ))}
        </ol>
      ) : ready.length ? null : (
        <p className={cn("mt-3 text-sm", dark ? "text-cream/60" : "text-muted")}>
          Line is empty.
        </p>
      )}
    </section>
  );
}
