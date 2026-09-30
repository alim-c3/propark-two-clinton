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
    <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full", up ? "bg-gold text-navy" : "bg-cream text-navy ring-1 ring-navy/30")}>
      <Icon className="size-3" strokeWidth={3} />
    </span>
  );
}

function StallCell({
  stall, dark, selected, highlight, hit, dest, onSelect, tall,
}: {
  stall: Stall; dark: boolean; selected: boolean; highlight?: string; dest?: string; hit: boolean;
  onSelect: (id: string) => void; tall?: boolean;
}) {
  const nested = Boolean(stall.blockedBy);
  const full = Boolean(stall.plate);
  const carLine = [stall.car, stall.color].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onSelect(stall.id)}
      className={cn(
        "relative w-full overflow-hidden border border-navy/30 px-1 py-1 text-left",
        tall ? "min-h-20" : "min-h-14 sm:min-h-16",
        !full && "bg-ok/20 text-ok",
        full && !nested && "bg-navy text-cream",
        full && nested && "bg-gold text-navy",
        dest === stall.id && "ring-2 ring-gold-2 ring-offset-1",
        (selected || highlight === stall.id) && "ring-2 ring-gold-2",
        hit && "stall-hit",
        dark && !full && "bg-ok/25",
        dark && full && !nested && !hit && "border-cream/20 bg-cream text-navy",
      )}
    >
      <span className="flex items-center justify-between text-[9px] opacity-80">
        <span>{stall.id}</span>
        <span className="flex items-center gap-0.5">
          <LiftMark deck={stall.liftDeck} />
          {stall.ev ? <Zap className="size-3 text-ok" strokeWidth={2.5} /> : null}
        </span>
      </span>
      {full ? (
        <>
          <span className="mt-0.5 block truncate text-[10px] font-semibold leading-tight">{carLine || stall.car}</span>
          <span className="block truncate text-[9px] opacity-80">{stall.plate}</span>
        </>
      ) : (
        <span className="mt-0.5 block text-[10px] font-semibold">open</span>
      )}
      {stall.ada ? <span className="absolute right-0.5 bottom-0.5 text-[8px] font-bold">ADA</span> : null}
    </button>
  );
}

function Room({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center border border-navy/40 bg-[#d8d2c4] text-[8px] font-bold uppercase tracking-wide text-navy/70", className)}>
      {label}
    </div>
  );
}

function Drive({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center bg-[#cfc8b8] text-[8px] font-bold tracking-[0.16em] text-navy/50", className)}>
      {label ? <span>↔ {label} ↔</span> : null}
    </div>
  );
}

function Plate({
  level, stalls, dark, sel, highlight, dest, hitIds, onPick,
}: {
  level: Level;
  stalls: Stall[];
  dark: boolean;
  sel: string | null;
  highlight?: string;
  dest?: string;
  hitIds: Set<string>;
  onPick: (id: string) => void;
}) {
  const byId = (id: string) => stalls.find((s) => s.id === id);
  const cell = (id: string, tall?: boolean) => {
    const s = byId(id);
    if (!s) return <Room label={id} />;
    return (
      <StallCell stall={s} dark={dark} selected={sel === s.id} highlight={highlight} dest={dest} hit={hitIds.has(s.id)} onSelect={onPick} tall={tall} />
    );
  };
  const here3 = level === "3B";

  return (
    <section className={cn("overflow-hidden rounded-2xl border", dark ? "border-navy-2 bg-navy-2/40 text-cream" : "border-line bg-[#efe9dc] text-navy")}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
            {here3 ? "GARAGE 3B · A-101 / A-131" : "GARAGE 2B · A-132"}
          </p>
          <p className={cn("mt-1 text-sm", dark ? "text-cream/70" : "text-muted")}>
            {here3
              ? "X You are here at the core. Two-way drive through the plate. Wing runs east to the vehicle elevator."
              : "I’m here at the vehicle elevator landing. Same L. Two-way drive. North block is farther from the cab."}
          </p>
        </div>
        <p className="shrink-0 rounded-full bg-navy px-3 py-1 text-[10px] font-bold tracking-wide text-gold">
          {here3 ? "YOU ARE HERE · CORE" : "I’M HERE · LIFT"}
        </p>
      </div>

      <div className="p-3 sm:p-4">
        <p className="mb-1 text-center text-[9px] font-bold tracking-[0.2em] text-muted">NORTH BLOCK</p>
        <div className="grid grid-cols-8 gap-px border-2 border-navy bg-navy/20">
          {cell("B-12", true)}
          {cell("A-01")}
          {cell("A-02")}
          {cell("A-03")}
          {cell("A-04")}
          <div className="col-span-3 bg-[#efe9dc]" />

          {cell("B-14", true)}
          {cell("A-05")}
          {cell("A-06")}
          <Room label={here3 ? "X CORE" : "CORE"} className="bg-navy text-[9px] text-gold" />
          <Room label="STAIR" />
          <div className="col-span-3 bg-[#efe9dc]" />

          {cell("B-16", true)}
          {cell("R-01")}
          {cell("R-02")}
          <Room label="FE" />
          <Room label="ADA RM" />
          <div className="col-span-3 bg-[#efe9dc]" />

          <Drive label="N–S" className="min-h-8" />
          <Drive label="TWO-WAY DRIVE" className="col-span-4 min-h-8" />
          <Drive label="TO WING" className="col-span-3 min-h-8" />

          {cell("B-11")}
          {cell("B-13")}
          {cell("B-15")}
          {cell("B-17")}
          {cell("B-19")}
          {cell("B-21")}
          {cell("C-01")}
          {cell("C-02")}

          {cell("B-18")}
          {cell("B-20")}
          {cell("B-22")}
          <Drive className="min-h-14" />
          <Drive className="min-h-14" />
          {cell("C-03")}
          {cell("C-04")}
          {cell("C-05")}

          <Drive label="EAST WING AISLE · TWO-WAY" className="col-span-6 min-h-8" />
          <Room label={here3 ? "LIFT MR" : "I’M HERE"} className={cn("col-span-2 min-h-8", !here3 && "bg-gold text-navy")} />

          {cell("P-01")}
          {cell("P-02")}
          {cell("P-03")}
          {cell("P-04")}
          {cell("P-05")}
          {cell("P-06")}
          {cell("C-06")}
          <Room label="CAB" className="bg-navy text-gold" />
        </div>
        <div className="mt-2 flex justify-between text-[9px] font-bold tracking-[0.16em] text-muted">
          <span>WEST STACK</span>
          <span>PROSPECT</span>
          <span className="text-gold-2">DIVISION · VEHICLE ELEVATOR</span>
        </div>
      </div>
    </section>
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
  const hits = searchDeck(q, stalls, tickets);
  const hitIds = new Set(hits.map((h) => h.stallId).filter(Boolean) as string[]);
  const [sel, setSel] = useState<string | null>(highlight ?? null);
  const dark = tone === "dark";

  useEffect(() => {
    if (!q.trim()) return;
    const first = searchDeck(q, occupancy(tickets), tickets).find((h) => h.stallId)?.stallId;
    if (first) setSel(first);
  }, [q, tickets]);

  const stall = stalls.find((s) => s.id === sel) ?? stalls.find((s) => s.id === highlight);
  function pick(id: string) {
    setSel(id);
    onPick?.(id);
  }

  return (
    <div className="space-y-4">
      {compact ? null : (
        <section className={cn("rounded-2xl border p-4", dark ? "border-navy-2 bg-navy-2/40 text-cream" : "border-line bg-white text-navy")}>
          <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">LESSARD PLATE · 3B THEN 2B</p>
          <p className={cn("mt-1 text-xs", dark ? "text-cream/70" : "text-muted")}>
            Scroll the two floors. Same L as A-101 / A-131 / A-132. Grey band is the two-way drive.
          </p>
          <label className="relative mt-3 block">
            <Search className={cn("pointer-events-none absolute top-3.5 left-3 size-4", dark ? "text-cream/50" : "text-muted")} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tesla, HST-4412, B-14…" autoComplete="off" className={cn("w-full rounded-xl border py-3 pr-3 pl-10 text-sm", dark ? "border-navy-2 bg-navy text-cream placeholder:text-cream/40" : "border-line bg-cream text-navy placeholder:text-muted")} />
          </label>
          {fold(q).length >= 2 ? (
            <ul className="mt-2 flex max-h-32 flex-col gap-1 overflow-y-auto">
              {hits.length ? hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => h.stallId && setSel(h.stallId)} className={cn("flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm", sel === h.stallId ? "bg-gold text-navy" : "bg-cream text-navy")}>
                    <span className="truncate font-semibold">{h.car} · {h.plate}</span>
                    <span className="font-display">{h.where}</span>
                  </button>
                </li>
              )) : <li className="px-1 py-2 text-sm text-muted">Nothing on the deck matches.</li>}
            </ul>
          ) : null}
          {stall ? (
            <p className={cn("mt-3 text-sm", dark ? "text-cream/80" : "text-muted")}>
              {stall.plate ? `${stall.id} · ${[stall.car, stall.color].filter(Boolean).join(" · ")} · ${stall.plate}${stall.blockedBy ? ` · nested behind ${stall.blockedBy}` : ""}` : `${stall.id} open`}
            </p>
          ) : null}
        </section>
      )}
      <Plate level="3B" stalls={stalls} dark={dark} sel={sel} highlight={highlight} dest={dest} hitIds={hitIds} onPick={pick} />
      <Plate level="2B" stalls={stalls} dark={dark} sel={sel} highlight={highlight} dest={dest} hitIds={hitIds} onPick={pick} />
    </div>
  );
}
