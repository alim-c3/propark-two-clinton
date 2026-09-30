"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Search, Zap } from "lucide-react";
import { fold, searchDeck } from "@/lib/search";
import { STALLS } from "@/lib/seed";
import { useLane } from "@/lib/store";
import type { Stall, Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";

type Level = "3B" | "2B";

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
    const nestCleared = tickets.some((t) => t.stall === s.id && t.unnestedAt && !t.blockedBy);
    const blockerMoved = tickets.some((t) => t.stall === s.blocks && t.unnestedAt);
    if (inbound && inbound.status === "staged") {
      return { ...s, plate: inbound.plate, car: inbound.car, color: inbound.color, unit: inbound.unit, blockedBy: undefined };
    }
    if (inbound && inbound.status !== "released" && inbound.status !== "cancelled") {
      return { ...s, plate: null, car: undefined, color: undefined, unit: undefined, blockedBy: undefined };
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
    <span title={up ? "Upper platform" : "Lower platform"} className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", up ? "bg-gold text-navy" : "bg-cream text-navy ring-1 ring-navy/30")}>
      <Icon className="size-3" strokeWidth={3} />
    </span>
  );
}

function StallCell({
  stall, dark, selected, highlight, hit, dest, onSelect,
}: {
  stall: Stall; dark: boolean; selected: boolean; highlight?: string; dest?: string; hit: boolean; onSelect: (id: string) => void;
}) {
  const mine = highlight === stall.id;
  const going = dest === stall.id;
  const nested = Boolean(stall.blockedBy);
  const full = Boolean(stall.plate);
  const carLine = [stall.car, stall.color].filter(Boolean).join(" · ");
  return (
    <button type="button" onClick={() => onSelect(stall.id)} className={cn(
      "relative min-h-16 w-full overflow-hidden rounded-sm border px-1 py-1 text-left sm:min-h-20",
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
    )}>
      <span className="flex items-center justify-between gap-0.5 text-[9px] leading-none tracking-wide opacity-80">
        <span>{stall.id}</span>
        <span className="flex items-center gap-0.5">
          <LiftMark deck={stall.liftDeck} />
          {stall.ev ? <Zap className="size-3 shrink-0 text-ok" strokeWidth={2.5} /> : null}
        </span>
      </span>
      {full ? (
        <>
          <span className="mt-0.5 block truncate text-[10px] leading-tight font-semibold">{carLine || stall.car}</span>
          <span className="block truncate text-[9px] leading-tight opacity-80">{stall.plate}</span>
        </>
      ) : (
        <span className="mt-0.5 block text-[10px] font-semibold leading-tight">open</span>
      )}
      {stall.ada ? <span className="absolute right-0.5 bottom-0.5 text-[8px] font-bold">ADA</span> : null}
    </button>
  );
}

function CoreCell({ label, dark, hint }: { label: string; dark: boolean; hint?: string }) {
  return (
    <div title={hint} className={cn("flex min-h-16 items-center justify-center rounded-sm border text-[9px] font-bold uppercase tracking-wide sm:min-h-20", dark ? "border-navy bg-navy text-cream/70" : "border-line bg-line text-muted")}>
      {label}
    </div>
  );
}

function Aisle({ label, dark }: { label: string; dark: boolean }) {
  return (
    <div className={cn("flex h-8 items-center justify-between rounded-sm px-2 text-[9px] font-bold tracking-[0.14em]", dark ? "bg-navy text-cream/55" : "bg-navy/10 text-muted")}>
      <span>↔</span><span>{label}</span><span>↔</span>
    </div>
  );
}

export function GarageMap({
  tone = "light", highlight, dest, onPick, compact,
}: {
  tone?: "light" | "dark"; highlight?: string; dest?: string; onPick?: (stallId: string) => void; compact?: boolean;
}) {
  const tickets = useLane((s) => s.tickets);
  const stalls = occupancy(tickets);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<Level>("3B");
  const hits = searchDeck(q, stalls, tickets);
  const hitIds = new Set(hits.map((h) => h.stallId).filter(Boolean) as string[]);
  const [sel, setSel] = useState<string | null>(highlight ?? null);
  const dark = tone === "dark";
  const byId = (id: string) => stalls.find((s) => s.id === id);

  useEffect(() => {
    if (!q.trim()) return;
    const first = searchDeck(q, occupancy(tickets), tickets).find((h) => h.stallId)?.stallId;
    if (first) setSel(first);
  }, [q, tickets]);

  const stall = stalls.find((s) => s.id === sel) ?? stalls.find((s) => s.id === highlight);
  function pick(id: string) { setSel(id); onPick?.(id); }
  function cell(id: string) {
    const s = byId(id);
    if (!s) return <CoreCell label={id} dark={dark} />;
    return <StallCell stall={s} dark={dark} selected={sel === s.id} highlight={highlight} dest={dest} hit={hitIds.has(s.id)} onSelect={pick} />;
  }
  const threeB = level === "3B";

  return (
    <section className={cn("rounded-2xl border p-4", dark ? "border-navy-2 bg-navy-2/40 text-cream" : "border-line bg-white text-navy")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
            {threeB ? "3B · YOU ARE HERE AT THE CORE" : "2B · I'M HERE AT THE VEHICLE ELEVATOR"}
          </p>
          <p className={cn("mt-1 text-xs", dark ? "text-cream/70" : "text-muted")}>
            {compact ? "L-plate from Lessard A-101 / A-131 / A-132. Gold ring is the stall." : "Same L as the wall drawings. Two-way aisles. Lift at the east tip. Search make, plate, or stall."}
          </p>
        </div>
        <div className="flex gap-1">
          {(["3B", "2B"] as Level[]).map((lv) => (
            <button key={lv} type="button" onClick={() => setLevel(lv)} className={cn("rounded-full px-3 py-1 text-xs font-bold", level === lv ? "bg-gold text-navy" : dark ? "bg-navy text-cream" : "bg-cream text-navy")}>
              {lv}
            </button>
          ))}
        </div>
      </div>

      {compact ? null : (
        <>
          <label className="relative mt-3 block">
            <Search className={cn("pointer-events-none absolute top-3.5 left-3 size-4", dark ? "text-cream/50" : "text-muted")} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tesla, HST-4412, B-14…" autoComplete="off" className={cn("w-full rounded-xl border py-3 pr-3 pl-10 text-sm", dark ? "border-navy-2 bg-navy text-cream placeholder:text-cream/40" : "border-line bg-cream text-navy placeholder:text-muted")} />
          </label>
          {fold(q).length >= 2 ? (
            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
              {hits.length ? hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => h.stallId && setSel(h.stallId)} className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm", sel === h.stallId ? "bg-gold text-navy" : dark ? "bg-navy text-cream hover:bg-navy-2" : "bg-cream text-navy hover:bg-line")}>
                    <span className="min-w-0 truncate"><span className="font-semibold">{h.car}</span>{h.unit ? ` · APT ${h.unit}` : ""}<span className={cn("block text-xs", sel === h.stallId ? "text-navy/70" : "text-muted")}>{h.plate}</span></span>
                    <span className="shrink-0 font-display text-lg">{h.where}</span>
                  </button>
                </li>
              )) : <li className={cn("px-1 py-2 text-sm", dark ? "text-cream/60" : "text-muted")}>Nothing on the deck matches.</li>}
            </ul>
          ) : q.trim() ? (
            <p className={cn("mt-2 text-sm", dark ? "text-cream/60" : "text-muted")}>Keep typing — make, model, plate, or stall.</p>
          ) : null}
        </>
      )}

      <p className="mt-4 text-center text-[10px] font-bold tracking-[0.2em] text-muted">NORTH BLOCK</p>
      <div className="mt-2 grid grid-cols-[1.25rem_1fr] gap-1 sm:grid-cols-[1.5rem_1fr] sm:gap-2">
        <p className="w-5 self-center [writing-mode:vertical-rl] rotate-180 text-center text-[9px] font-bold tracking-widest text-muted">WEST STACK</p>
        <div className="min-w-0 space-y-1">
          <p className="text-[9px] font-bold tracking-[0.16em] text-muted">{threeB ? "HOT · CORE / YOU ARE HERE" : "WARM · CORE ON 2B"}</p>
          <div className="grid grid-cols-6 gap-1">{cell("A-01")}{cell("A-02")}{cell("A-03")}<CoreCell label="Core" dark={dark} hint="Elevators / stairs · 3B X mark" />{cell("R-01")}{cell("R-02")}</div>
          <div className="grid grid-cols-6 gap-1">{cell("A-04")}{cell("A-05")}{cell("A-06")}<CoreCell label="Stair" dark={dark} /><CoreCell label="FE" dark={dark} hint="Fire extinguisher" /><CoreCell label="ADA" dark={dark} /></div>
          <Aisle label="TWO-WAY · THROUGH CORE" dark={dark} />
          <p className="text-[9px] font-bold tracking-[0.16em] text-muted">WARM · SOUTH MID-PLATE</p>
          <div className="grid grid-cols-6 gap-1">{cell("B-11")}{cell("B-13")}{cell("B-15")}{cell("B-17")}{cell("B-19")}{cell("B-21")}</div>
          <p className="text-[9px] font-bold tracking-[0.16em] text-muted">STACK / NEST · WALL SIDE</p>
          <div className="grid grid-cols-6 gap-1">{cell("B-12")}{cell("B-14")}{cell("B-16")}{cell("B-18")}{cell("B-20")}{cell("B-22")}</div>
        </div>
      </div>
      <Aisle label={threeB ? "EAST WING · TWO-WAY TO VEHICLE ELEVATOR" : "EAST WING · LANDING IS HOT"} dark={dark} />
      <div className="grid grid-cols-[1fr_4.5rem] gap-1">
        <div className="space-y-1">
          <div className="grid grid-cols-6 gap-1">{cell("C-01")}{cell("C-02")}{cell("C-03")}{cell("C-04")}{cell("C-05")}{cell("C-06")}</div>
          <div className="grid grid-cols-6 gap-1">{cell("P-01")}{cell("P-02")}{cell("P-03")}{cell("P-04")}{cell("P-05")}{cell("P-06")}</div>
        </div>
        <div className="flex flex-col gap-1">
          <CoreCell label={threeB ? "Lift MR" : "I'm here"} dark={dark} hint="Vehicle elevator" />
          <CoreCell label="Cab" dark={dark} />
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-bold tracking-[0.16em] text-muted">
        <span>PROSPECT</span><span>EAST TIP · VEHICLE ELEVATOR</span><span className="text-gold-2">DIVISION / CURB</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        <span className="rounded bg-ok/20 px-2 py-1 font-semibold text-ok">Open</span>
        <span className="rounded bg-navy px-2 py-1 font-semibold text-cream">Occupied</span>
        <span className="rounded bg-gold px-2 py-1 font-semibold text-navy">Nested</span>
        <span className="inline-flex items-center gap-1 rounded bg-gold px-2 py-1 font-semibold text-navy"><ArrowUp className="size-3" strokeWidth={3} /> Upper</span>
        <span className="inline-flex items-center gap-1 rounded bg-cream px-2 py-1 font-semibold text-navy ring-1 ring-navy/20"><ArrowDown className="size-3" strokeWidth={3} /> Lower</span>
        <span className="rounded px-2 py-1 font-semibold text-ok ring-1 ring-ok ring-inset">EV</span>
      </div>
      <p className={cn("mt-3 text-sm", dark ? "text-cream/80" : "text-muted")}>
        {stall
          ? stall.plate
            ? `${stall.id} · ${[stall.car, stall.color].filter(Boolean).join(" · ")} · ${stall.plate}${stall.unit ? ` · APT ${stall.unit}` : ""}${stall.liftDeck === "upper" ? " · UPPER — drop the stacker" : stall.liftDeck === "lower" ? " · LOWER" : ""}${stall.liftPair ? ` · pair ${stall.liftPair}` : ""}${stall.blockedBy ? ` · nested behind ${stall.blockedBy}` : ""}${stall.blocks ? ` · blocks ${stall.blocks}` : ""} · ${level}`
            : `${stall.id} open${stall.ev ? " · EV" : ""}${stall.ada ? " · ADA" : ""} · ${level}`
          : threeB
            ? "3B runner node is the core. East wing is cold unless the car is going up the lift."
            : "2B landing at the lift is hot. North block is farther from the cab."}
      </p>
    </section>
  );
}
