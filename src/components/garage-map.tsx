"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Search, Zap } from "lucide-react";
import { fold, searchDeck } from "@/lib/search";
import { STALLS } from "@/lib/seed";
import { useLane } from "@/lib/store";
import type { Stall, StallZone, Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";

function occupancy(tickets: Ticket[]): Stall[] {
  return STALLS.map((s) => {
    const pulled = tickets.find(
      (t) =>
        t.stall === s.id &&
        (t.type === "now" || t.type === "scheduled" || t.type === "restack") &&
        (t.status === "staged" || t.status === "released"),
    );
    const inbound = tickets.find(
      (t) =>
        t.type === "arrival" &&
        t.toStall === s.id &&
        t.status !== "cancelled" &&
        t.status !== "released",
    );
    const nestCleared = tickets.some(
      (t) => t.stall === s.id && t.unnestedAt && !t.blockedBy,
    );
    const blockerMoved = tickets.some((t) => t.stall === s.blocks && t.unnestedAt);
    if (inbound && inbound.status === "staged") {
      return {
        ...s,
        plate: inbound.plate,
        car: inbound.car,
        color: inbound.color,
        unit: inbound.unit,
        blockedBy: undefined,
      };
    }
    if (
      inbound &&
      inbound.status !== "released" &&
      inbound.status !== "cancelled"
    ) {
      return {
        ...s,
        plate: null,
        car: undefined,
        color: undefined,
        unit: undefined,
        blockedBy: undefined,
      };
    }
    if (!pulled && !nestCleared && !blockerMoved) return s;
    return {
      ...s,
      plate: pulled ? null : s.plate,
      car: pulled ? undefined : s.car,
      color: pulled ? undefined : s.color,
      unit: pulled ? undefined : s.unit,
      blockedBy: pulled || nestCleared ? undefined : s.blockedBy,
      blocks: pulled || blockerMoved ? undefined : s.blocks,
    };
  });
}

function LiftMark({ deck }: { deck?: "upper" | "lower" }) {
  if (!deck) return null;
  const up = deck === "upper";
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      title={up ? "Car on the upper platform" : "Car on the lower platform"}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full",
        up ? "bg-gold text-navy" : "bg-cream text-navy ring-1 ring-navy/30",
      )}
    >
      <Icon className="size-3" strokeWidth={3} />
    </span>
  );
}

function StallCell({
  stall,
  dark,
  selected,
  highlight,
  hit,
  dest,
  onSelect,
  open: openTo,
}: {
  stall: Stall;
  dark: boolean;
  selected: boolean;
  highlight?: string;
  dest?: string;
  hit: boolean;
  onSelect: (id: string) => void;
  open: "up" | "down";
}) {
  const mine = highlight === stall.id;
  const going = dest === stall.id;
  const nested = Boolean(stall.blockedBy);
  const full = Boolean(stall.plate);
  const carLine = [stall.car, stall.color].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onSelect(stall.id)}
      className={cn(
        "relative min-h-16 w-full overflow-hidden px-1 py-1 text-left sm:min-h-20",
        openTo === "up"
          ? "rounded-b-sm border-x border-b"
          : "rounded-t-sm border-x border-t",
        !full && "border-ok/50 bg-ok/20 text-ok",
        full && !nested && "border-navy bg-navy text-cream",
        full && nested && "border-gold-2 bg-gold text-navy",
        going && "ring-2 ring-gold-2 ring-offset-1",
        (selected || mine) && "ring-2 ring-gold-2",
        hit && "stall-hit",
        dark && !full && "border-ok/60 bg-ok/25 text-ok",
        dark && full && !nested && !hit && "border-cream/20 bg-cream text-navy",
        dark && full && nested && "border-gold bg-gold text-navy",
        hit && full && "bg-gold text-navy",
      )}
    >
      <span className="flex items-center justify-between gap-0.5 text-[9px] leading-none tracking-wide opacity-80">
        <span>{stall.id}</span>
        <span className="flex items-center gap-0.5">
          <LiftMark deck={stall.liftDeck} />
          {stall.ev ? <Zap className="size-3 shrink-0 text-ok" strokeWidth={2.5} /> : null}
        </span>
      </span>
      {full ? (
        <>
          <span className="mt-0.5 block truncate text-[10px] leading-tight font-semibold">
            {carLine || stall.car}
          </span>
          <span className="block truncate text-[9px] leading-tight opacity-80">
            {stall.plate}
          </span>
        </>
      ) : (
        <span className="mt-0.5 block text-[10px] font-semibold leading-tight">open</span>
      )}
      {stall.ada ? (
        <span className="absolute right-0.5 bottom-0.5 text-[8px] font-bold">ADA</span>
      ) : null}
    </button>
  );
}

function CoreCell({
  label,
  dark,
}: {
  label: string;
  dark: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-16 items-center justify-center rounded-sm border text-[9px] font-bold uppercase tracking-wide sm:min-h-20",
        dark ? "border-navy bg-navy text-cream/70" : "border-line bg-line text-muted",
      )}
    >
      {label}
    </div>
  );
}

function Aisle({
  label,
  dark,
}: {
  label: string;
  dark: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-8 items-center justify-between rounded-sm px-2 text-[9px] font-bold tracking-[0.14em]",
        dark ? "bg-navy text-cream/55" : "bg-navy/10 text-muted",
      )}
    >
      <span>←</span>
      <span>{label}</span>
      <span>→</span>
    </div>
  );
}

export function GarageMap({
  tone = "light",
  highlight,
  dest,
  onPick,
  compact,
}: {
  tone?: "light" | "dark";
  highlight?: string;
  dest?: string;
  onPick?: (stallId: string) => void;
  compact?: boolean;
}) {
  const tickets = useLane((s) => s.tickets);
  const stalls = occupancy(tickets);
  const [q, setQ] = useState("");
  const hits = searchDeck(q, stalls, tickets);
  const hitIds = new Set(hits.map((h) => h.stallId).filter(Boolean) as string[]);
  const [sel, setSel] = useState<string | null>(highlight ?? null);
  const dark = tone === "dark";
  const row = (zone: StallZone) =>
    stalls.filter((s) => s.zone === zone).sort((a, b) => a.col - b.col);

  useEffect(() => {
    if (!q.trim()) return;
    const first = searchDeck(q, occupancy(tickets), tickets).find((h) => h.stallId)
      ?.stallId;
    if (first) setSel(first);
  }, [q, tickets]);

  const stall = stalls.find((s) => s.id === sel) ?? stalls.find((s) => s.id === highlight);

  function pick(id: string) {
    setSel(id);
    onPick?.(id);
  }

  function cell(s: Stall, open: "up" | "down") {
    return (
      <StallCell
        key={s.id}
        stall={s}
        dark={dark}
        selected={sel === s.id}
        highlight={highlight}
        dest={dest}
        hit={hitIds.has(s.id)}
        onSelect={pick}
        open={open}
      />
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        dark ? "border-navy-2 bg-navy-2/40 text-cream" : "border-line bg-white text-navy",
      )}
    >
      <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
        P2 · RUNWAY DECK · TWO CLINTON
      </p>
      {compact ? (
        <p className={cn("mt-1 text-xs", dark ? "text-cream/70" : "text-muted")}>
          Gold ring is the stall. Tap a green open if you need to change it.
        </p>
      ) : (
        <p className={cn("mt-1 text-xs", dark ? "text-cream/70" : "text-muted")}>
          Find a car. We’ll light the stall. Search make, model, plate, or spot.
        </p>
      )}

      {compact ? null : (
        <>
      <label className="relative mt-3 block">
        <Search
          className={cn(
            "pointer-events-none absolute top-3.5 left-3 size-4",
            dark ? "text-cream/50" : "text-muted",
          )}
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tesla, HST-4412, B-14…"
          autoComplete="off"
          className={cn(
            "w-full rounded-xl border py-3 pr-3 pl-10 text-sm",
            dark
              ? "border-navy-2 bg-navy text-cream placeholder:text-cream/40"
              : "border-line bg-cream text-navy placeholder:text-muted",
          )}
        />
      </label>

      {fold(q).length >= 2 ? (
        <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
          {hits.length ? (
            hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => h.stallId && setSel(h.stallId)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm",
                    sel === h.stallId
                      ? "bg-gold text-navy"
                      : dark
                        ? "bg-navy text-cream hover:bg-navy-2"
                        : "bg-cream text-navy hover:bg-line",
                  )}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{h.car}</span>
                    {h.unit ? ` · APT ${h.unit}` : ""}
                    <span className={cn("block text-xs", sel === h.stallId ? "text-navy/70" : "text-muted")}>
                      {h.plate}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-lg">{h.where}</span>
                </button>
              </li>
            ))
          ) : (
            <li className={cn("px-1 py-2 text-sm", dark ? "text-cream/60" : "text-muted")}>
              Nothing on the deck matches.
            </li>
          )}
        </ul>
      ) : q.trim() ? (
        <p className={cn("mt-2 text-sm", dark ? "text-cream/60" : "text-muted")}>
          Keep typing — make, model, plate, or stall.
        </p>
      ) : null}
        </>
      )}

      <p className="mt-4 text-center text-[10px] font-bold tracking-[0.2em] text-muted">
        CLINTON PARK PLAZA
      </p>

      <div className="mt-2 grid grid-cols-[1.25rem_1fr_1.25rem] gap-1 sm:grid-cols-[1.5rem_1fr_1.5rem] sm:gap-2">
        <p className="w-5 self-center [writing-mode:vertical-rl] rotate-180 text-center text-[9px] font-bold tracking-widest text-muted">
          PROSPECT
        </p>

        <div className="min-w-0 space-y-1">
          <div className="grid grid-cols-6 gap-1">
            <CoreCell label="Lift" dark={dark} />
            <CoreCell label="Cab 07" dark={dark} />
            {row("guest").map((s) => cell(s, "down"))}
            <CoreCell label="ADA" dark={dark} />
            <CoreCell label="Stair" dark={dark} />
          </div>

          <Aisle label="AISLE 1 · HOT / CURB · 6'9" dark={dark} />

          <div className="grid grid-cols-6 gap-1">
            {row("hot").map((s) => cell(s, "up"))}
          </div>

          <Aisle label="AISLE 2 · TANDEM B-ROW" dark={dark} />

          <p className="text-[9px] font-bold tracking-[0.16em] text-muted">
            AISLE SIDE · MOVE THESE FIRST
          </p>
          <div className="grid grid-cols-6 gap-1">
            {row("midAisle").map((s) => cell(s, "up"))}
          </div>
          <p className="text-[9px] font-bold tracking-[0.16em] text-muted">
            WALL SIDE · NESTED
          </p>
          <div className="grid grid-cols-6 gap-1">
            {row("midWall").map((s) => cell(s, "up"))}
          </div>

          <Aisle label="AISLE 3 · DEEP · STACKERS ↑↓" dark={dark} />

          <div className="grid grid-cols-6 gap-1">
            {row("deep").map((s) => cell(s, "up"))}
          </div>

          <div className="grid grid-cols-6 gap-1">
            {row("permit").map((s) => cell(s, "up"))}
          </div>
        </div>

        <p className="w-5 self-center [writing-mode:vertical-rl] text-center text-[9px] font-bold tracking-widest text-gold-2">
          RAMP · CLINTON PL
        </p>
      </div>

      <p className="mt-2 text-center text-[10px] font-bold tracking-[0.2em] text-muted">
        SOUTH DIVISION STREET
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        <span className="rounded bg-ok/20 px-2 py-1 font-semibold text-ok">Open</span>
        <span className="rounded bg-navy px-2 py-1 font-semibold text-cream">Occupied</span>
        <span className="rounded bg-gold px-2 py-1 font-semibold text-navy">Nested</span>
        <span className="inline-flex items-center gap-1 rounded bg-gold px-2 py-1 font-semibold text-navy">
          <ArrowUp className="size-3" strokeWidth={3} /> Upper
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-cream px-2 py-1 font-semibold text-navy ring-1 ring-navy/20">
          <ArrowDown className="size-3" strokeWidth={3} /> Lower
        </span>
        <span className="rounded px-2 py-1 font-semibold text-ok ring-1 ring-ok ring-inset">EV</span>
      </div>

      <p className={cn("mt-3 text-sm", dark ? "text-cream/80" : "text-muted")}>
        {stall
          ? stall.plate
            ? `${stall.id} · ${[stall.car, stall.color].filter(Boolean).join(" · ")} · ${stall.plate}${stall.unit ? ` · APT ${stall.unit}` : ""}${
                stall.liftDeck === "upper"
                  ? " · UPPER — drop the stacker to pull"
                  : stall.liftDeck === "lower"
                    ? " · LOWER platform"
                    : ""
              }${stall.liftPair ? ` · pair ${stall.liftPair}` : ""}${stall.blockedBy ? ` · nested behind ${stall.blockedBy}` : ""}${stall.blocks ? ` · blocks ${stall.blocks}` : ""}${dest === stall.id ? " · going here" : ""}`
            : `${stall.id} open${stall.liftDeck === "upper" ? " · UPPER empty" : stall.liftDeck === "lower" ? " · LOWER empty" : ""}${stall.liftPair ? ` · pair ${stall.liftPair}` : ""}${stall.ev ? " · EV" : ""}${stall.ada ? " · ADA" : ""}${dest === stall.id ? " · park here" : ""}`
          : dest
            ? `Tap a car to take it in or out. Going to ${dest}.`
            : "Tap a stall — or search to light it up"}
      </p>
    </section>
  );
}
