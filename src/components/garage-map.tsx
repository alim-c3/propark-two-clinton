"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { fold, searchDeck } from "@/lib/search";
import { STALLS } from "@/lib/seed";
import { useLane } from "@/lib/store";
import type { Stall, Ticket } from "@/lib/types";
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

type Spot = { id: string; x: number; y: number; w: number; h: number; stack?: boolean };

const SPOTS: Spot[] = [
  { id: "B-12", x: 4.2, y: 8, w: 7.2, h: 9, stack: true },
  { id: "B-14", x: 4.2, y: 17.4, w: 7.2, h: 9, stack: true },
  { id: "B-16", x: 4.2, y: 26.8, w: 7.2, h: 9, stack: true },
  { id: "B-18", x: 4.2, y: 36.2, w: 7.2, h: 9, stack: true },
  { id: "A-01", x: 13.5, y: 6.5, w: 7.4, h: 7.4 },
  { id: "A-02", x: 21.4, y: 6.5, w: 7.4, h: 7.4 },
  { id: "A-03", x: 29.3, y: 6.5, w: 7.4, h: 7.4 },
  { id: "A-04", x: 37.2, y: 6.5, w: 7.4, h: 7.4 },
  { id: "A-05", x: 13.5, y: 15, w: 7.4, h: 7.4 },
  { id: "A-06", x: 21.4, y: 15, w: 7.4, h: 7.4 },
  { id: "R-01", x: 45.5, y: 18, w: 7, h: 7 },
  { id: "R-02", x: 45.5, y: 26, w: 7, h: 7 },
  { id: "B-11", x: 13.5, y: 48, w: 7.2, h: 6.6 },
  { id: "B-13", x: 21.2, y: 48, w: 7.2, h: 6.6 },
  { id: "B-15", x: 28.9, y: 48, w: 7.2, h: 6.6 },
  { id: "B-17", x: 13.5, y: 55.2, w: 7.2, h: 6.6 },
  { id: "B-19", x: 21.2, y: 55.2, w: 7.2, h: 6.6 },
  { id: "B-21", x: 28.9, y: 55.2, w: 7.2, h: 6.6 },
  { id: "C-01", x: 48, y: 58.5, w: 6.4, h: 6.2 },
  { id: "C-02", x: 55, y: 58.5, w: 6.4, h: 6.2 },
  { id: "C-03", x: 62, y: 58.5, w: 6.4, h: 6.2 },
  { id: "C-04", x: 69, y: 58.5, w: 6.4, h: 6.2 },
  { id: "C-05", x: 48, y: 82, w: 6.4, h: 6.2 },
  { id: "C-06", x: 55, y: 82, w: 6.4, h: 6.2 },
  { id: "P-01", x: 62, y: 82, w: 6.4, h: 6.2 },
  { id: "P-02", x: 69, y: 82, w: 6.4, h: 6.2 },
  { id: "P-03", x: 48, y: 88.6, w: 6.4, h: 6.2 },
  { id: "P-04", x: 55, y: 88.6, w: 6.4, h: 6.2 },
  { id: "P-05", x: 62, y: 88.6, w: 6.4, h: 6.2 },
  { id: "P-06", x: 69, y: 88.6, w: 6.4, h: 6.2 },
];

function fillFor(s: Stall | undefined, hit: boolean, dest?: string) {
  if (!s) return "rgba(180,175,160,0.35)";
  if (dest === s.id) return "#c9a227";
  if (hit) return "#c9a227";
  if (s.blockedBy) return "#c9a227";
  if (s.plate) return "#152033";
  return "rgba(31,107,74,0.45)";
}

function Plate({
  level, stalls, sel, highlight, dest, hitIds, onPick, dark,
}: {
  level: "3B" | "2B";
  stalls: Stall[];
  sel: string | null;
  highlight?: string;
  dest?: string;
  hitIds: Set<string>;
  onPick: (id: string) => void;
  dark: boolean;
}) {
  const byId = (id: string) => stalls.find((s) => s.id === id);
  const three = level === "3B";
  return (
    <section className={cn("overflow-hidden rounded-2xl border", dark ? "border-navy-2 bg-[#1a2433] text-cream" : "border-line bg-[#f3efe4] text-navy")}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">{three ? "GARAGE 3B PLAN · A-101" : "GARAGE 2B SLAB · A-132"}</p>
          <p className={cn("mt-1 max-w-xl text-sm", dark ? "text-cream/70" : "text-muted")}>
            {three
              ? "Same L as the wall sheet. West stackers. Core X. Two-way drive into the east wing. Vehicle elevator at the tip."
              : "Same L one level down. Landing at the vehicle elevator is I’m here."}
          </p>
        </div>
        <p className="rounded-full bg-navy px-3 py-1 text-[10px] font-bold tracking-wide text-gold">
          {three ? "X YOU ARE HERE · CORE" : "I’M HERE · VEHICLE ELEV"}
        </p>
      </div>
      <div className="relative mx-auto w-full max-w-5xl p-3">
        <svg viewBox="0 0 1000 720" className="h-auto w-full" role="img" aria-label={`${level} garage plate`}>
          <rect width="1000" height="720" fill={dark ? "#121820" : "#efe8d8"} />
          <path d="M40 36 H560 V250 H430 V430 H40 Z" fill={dark ? "#2a3340" : "#e4dcc8"} stroke="#152033" strokeWidth="3" />
          <path d="M40 430 H960 V684 H40 Z" fill={dark ? "#2a3340" : "#e4dcc8"} stroke="#152033" strokeWidth="3" />
          <rect x="48" y="48" width="84" height="360" fill="none" stroke="#152033" strokeWidth="1.2" strokeDasharray="4 3" />
          <text x="90" y="240" textAnchor="middle" fontSize="11" fill="#152033" fontWeight="700">S S S S</text>
          <text x="90" y="256" textAnchor="middle" fontSize="9" fill="#6b6456">STACKERS</text>
          <rect x="248" y="268" width="130" height="118" fill={dark ? "#152033" : "#cfc6b2"} stroke="#152033" strokeWidth="2" />
          <text x="313" y="318" textAnchor="middle" fontSize="11" fill={dark ? "#e8c547" : "#152033"} fontWeight="700">ELEV LOBBY</text>
          <text x="313" y="336" textAnchor="middle" fontSize="10" fill={dark ? "#e8c547" : "#152033"}>STAIR</text>
          {three ? (
            <>
              <text x="360" y="210" textAnchor="middle" fontSize="28" fontWeight="800" fill="#c9a227">X</text>
              <text x="360" y="228" textAnchor="middle" fontSize="10" fill="#c9a227" fontWeight="700">YOU ARE HERE</text>
            </>
          ) : (
            <text x="313" y="354" textAnchor="middle" fontSize="10" fill="#6b6456">CORE</text>
          )}
          <path d="M140 400 H400" stroke="#9a917c" strokeWidth="22" />
          <path d="M400 400 V500 H780" stroke="#9a917c" strokeWidth="22" />
          <polygon points="400,389 418,400 400,411" fill="#152033" />
          <polygon points="140,389 122,400 140,411" fill="#152033" />
          <polygon points="780,489 798,500 780,511" fill="#152033" />
          <text x="270" y="396" textAnchor="middle" fontSize="9" fill="#152033" fontWeight="700">TWO-WAY DRIVE</text>
          <text x="590" y="496" textAnchor="middle" fontSize="9" fill="#152033" fontWeight="700">EAST WING AISLE</text>
          <rect x="800" y="448" width="148" height="220" fill={three ? "#d7c9a3" : "#c9a227"} stroke="#152033" strokeWidth="2" />
          <text x="874" y="500" textAnchor="middle" fontSize="11" fontWeight="700" fill="#152033">VEHICLE ELEV</text>
          <text x="874" y="518" textAnchor="middle" fontSize="10" fill="#152033">MACHINE</text>
          <text x="874" y="536" textAnchor="middle" fontSize="10" fill="#152033">CAB</text>
          {!three ? <text x="874" y="568" textAnchor="middle" fontSize="11" fontWeight="800" fill="#152033">I&apos;M HERE</text> : null}
          <text x="874" y="650" textAnchor="middle" fontSize="9" fill="#152033">RAMP / LIFT</text>
          <g fill="#c45a12">
            <circle cx="300" cy="250" r="7" />
            <circle cx="250" cy="390" r="7" />
            <circle cx="640" cy="560" r="7" />
            <circle cx="874" cy="620" r="7" />
          </g>
          <text x="314" y="246" fontSize="9" fill="#c45a12" fontWeight="700">FE</text>
          <text x="262" y="394" fontSize="9" fill="#c45a12" fontWeight="700">FE</text>
          <text x="652" y="564" fontSize="9" fill="#c45a12" fontWeight="700">FE</text>
          <text x="886" y="624" fontSize="9" fill="#c45a12" fontWeight="700">FE</text>
          {SPOTS.map((p) => {
            const s = byId(p.id);
            const active = sel === p.id || highlight === p.id || dest === p.id || hitIds.has(p.id);
            const full = Boolean(s?.plate);
            return (
              <g key={p.id} onClick={() => onPick(p.id)} className="cursor-pointer">
                <rect x={p.x * 10} y={p.y * 7.2} width={p.w * 10} height={p.h * 7.2} fill={fillFor(s, hitIds.has(p.id), dest)} stroke={active ? "#e8c547" : "#152033"} strokeWidth={active ? 3 : 1.2} />
                <line x1={p.x * 10} y1={p.y * 7.2} x2={p.x * 10 + p.w * 10} y2={p.y * 7.2 + p.h * 7.2} stroke="rgba(21,32,51,0.25)" strokeWidth="0.8" />
                <line x1={p.x * 10 + p.w * 10} y1={p.y * 7.2} x2={p.x * 10} y2={p.y * 7.2 + p.h * 7.2} stroke="rgba(21,32,51,0.25)" strokeWidth="0.8" />
                <text x={p.x * 10 + (p.w * 10) / 2} y={p.y * 7.2 + 12} textAnchor="middle" fontSize="8" fill={full && !s?.blockedBy ? "#f4efe4" : "#152033"} fontWeight="700">{p.id}{p.stack ? " ↑" : ""}</text>
              </g>
            );
          })}
          <text x="300" y="28" textAnchor="middle" fontSize="10" fill="#6b6456" fontWeight="700">NORTH BLOCK</text>
          <text x="90" y="708" textAnchor="middle" fontSize="10" fill="#6b6456" fontWeight="700">WEST</text>
          <text x="500" y="708" textAnchor="middle" fontSize="10" fill="#6b6456" fontWeight="700">SOUTH DRIVE</text>
          <text x="874" y="708" textAnchor="middle" fontSize="10" fill="#c9a227" fontWeight="700">DIVISION · VE</text>
        </svg>
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
  function pick(id: string) { setSel(id); onPick?.(id); }
  return (
    <div className="space-y-4">
      {compact ? null : (
        <section className={cn("rounded-2xl border p-4", dark ? "border-navy-2 bg-navy-2/40 text-cream" : "border-line bg-white text-navy")}>
          <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">LESSARD A-101 · SCROLL 3B THEN 2B</p>
          <p className={cn("mt-1 text-xs", dark ? "text-cream/70" : "text-muted")}>L plate, two-way drive, west stackers, core X, east wing to the vehicle elevator. Tap a stall.</p>
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
      <Plate level="3B" stalls={stalls} sel={sel} highlight={highlight} dest={dest} hitIds={hitIds} onPick={pick} dark={dark} />
      <Plate level="2B" stalls={stalls} sel={sel} highlight={highlight} dest={dest} hitIds={hitIds} onPick={pick} dark={dark} />
    </div>
  );
}
