"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
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

type Cell = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  live?: boolean;
  stack?: boolean;
};

const SW = 8.5;
const SD = 18;
const LIVE: Record<string, string> = {
  S2: "B-12",
  S4: "B-14",
  S6: "B-16",
  S8: "B-18",
  N1: "A-01",
  N2: "A-02",
  N3: "A-03",
  N4: "A-04",
  M1: "A-05",
  M2: "A-06",
  E1: "R-01",
  E2: "R-02",
  W1: "B-11",
  K1: "B-13",
  K2: "B-15",
  W2: "B-17",
  K3: "B-19",
  K4: "B-21",
  C1: "C-01",
  C2: "C-02",
  C3: "C-03",
  C4: "C-04",
  D1: "C-05",
  D2: "C-06",
  D3: "P-01",
  D4: "P-02",
  D20: "P-03",
  D21: "P-04",
  D22: "P-05",
  D23: "P-06",
};

function cells(): Cell[] {
  const out: Cell[] = [];
  const add = (id: string, x: number, y: number, w: number, h: number, stack = false) => {
    const liveId = LIVE[id];
    out.push({ id: liveId ?? id, x, y, w, h, live: Boolean(liveId), stack });
  };
  for (let col = 0; col < 2; col++) {
    for (let i = 0; i < 10; i++) add(`S${col * 10 + i + 1}`, 2 + col * SD, 4 + i * SW, SD, SW, true);
  }
  for (let i = 0; i < 7; i++) add(`N${i + 1}`, 62 + i * SW, 4, SW, SD);
  for (let i = 0; i < 2; i++) add(`N${i + 8}`, 152 + i * SW, 4, SW, SD);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 7; c++) add(`M${r * 7 + c + 1}`, 62 + c * SW, 46 + r * SD, SW, SD);
  }
  for (let i = 0; i < 9; i++) add(`E${i + 1}`, 152, 22 + i * SW, SD, SW);
  add("ADA1", 152, 106, SD, SW);
  add("ADA2", 152, 106 + SW, SD, SW);
  for (let i = 0; i < 4; i++) add(`W${i + 1}`, 62, 106 + i * SW, SD, SW);
  for (let i = 0; i < 4; i++) add(`K${i + 1}`, 124, 106 + i * SW, SD, SW);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) add(`Z${r * 9 + c + 1}`, 2 + c * SW, 190 + r * SD, SW, SD);
  }
  for (let i = 0; i < 20; i++) add(`C${i + 1}`, 80 + i * SW, 148, SW, SD);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 20; c++) add(`D${r * 20 + c + 1}`, 80 + c * SW, 190 + r * SD, SW, SD);
  }
  return out;
}

const SAMPLE_CARS: Array<[string, string]> = [
  ["Tesla Model 3", "EV-4410"],
  ["Honda Accord", "HND-2284"],
  ["Toyota Camry", "TNY-1902"],
  ["BMW 330i", "BXY-7741"],
  ["Audi A4", "AUD-3308"],
  ["Hyundai Tucson", "HYU-6612"],
  ["Ford Explorer", "FRD-9088"],
  ["Mercedes C300", "MRC-1520"],
];

function sampleCar(id: string) {
  let n = 0;
  for (const ch of id) n = (n * 33 + ch.charCodeAt(0)) % 997;
  const [car, plate] = SAMPLE_CARS[n % SAMPLE_CARS.length];
  return { taken: n % 5 < 2, car, plate };
}

function workingOn(tickets: Ticket[], viewer = "You") {
  const out: Record<string, { valet: string; car: string; plate: string; mine: boolean }> = {};
  for (const t of tickets) {
    if (!t.valet || (t.status !== "claimed" && t.status !== "staged")) continue;
    if (t.type !== "arrival" && t.status === "staged") continue;
    const stall = t.type === "arrival" ? t.toStall ?? t.stall : t.stall;
    if (!stall || stall === "curb") continue;
    out[stall] = { valet: t.valet, car: t.car, plate: t.plate, mine: t.valet === viewer };
  }
  return out;
}

function fillFor(occupied: boolean) {
  return occupied ? "#152033" : "#1f8a4c";
}

function Plate({
  level, stalls, sel, highlight, dest, hitIds, onPick, dark, working,
}: {
  level: "3B" | "2B";
  stalls: Stall[];
  sel: string | null;
  highlight?: string;
  dest?: string;
  hitIds: Set<string>;
  onPick: (id: string) => void;
  dark: boolean;
  working: Record<string, { valet: string; car: string; plate: string; mine: boolean }>;
}) {
  const three = level === "3B";
  const slab = dark ? "#2a3340" : "#e2dac8";
  const drive = dark ? "#3d4654" : "#b0a896";
  const ink = "#152033";
  const layout = useMemo(() => cells(), []);
  const byId = (id: string) => stalls.find((s) => s.id === id);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  function showTip(event: MouseEvent<SVGGElement>, text: string) {
    const box = event.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!box) return;
    setTip({
      text,
      x: event.clientX - box.left + 12,
      y: event.clientY - box.top + 14,
    });
  }

  return (
    <section className={cn("overflow-hidden rounded-2xl border", dark ? "border-navy-2 bg-[#1a2433] text-cream" : "border-line bg-[#f3efe4] text-navy")}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
            {three ? "GARAGE 3B PLAN · A-101 · 173 STALLS" : "GARAGE 2B SLAB · A-132 · SAME L"}
          </p>
          <p className={cn("mt-1 max-w-xl text-sm", dark ? "text-cream/70" : "text-muted")}>
            {three
              ? "8.5×18 bays. 24′ two-way aisles. Two-deep west stackers. Core X. Wing to the vehicle elevator."
              : "Same plate one level down. I’m here is the lift landing."}
          </p>
        </div>
        <p className="rounded-full bg-navy px-3 py-1 text-[10px] font-bold tracking-wide text-gold">
          {three ? "X YOU ARE HERE · CORE" : "I’M HERE · VEHICLE ELEV"}
        </p>
      </div>
      <div className="relative mx-auto w-full max-w-6xl p-3">
        <svg viewBox="0 0 316 262" className="h-auto w-full" role="img" aria-label={`${level} garage plate`}>
          <rect width="316" height="262" fill={dark ? "#121820" : "#efe8d8"} />
          <rect x="8" y="8" width="176" height="148" fill={slab} stroke={ink} strokeWidth="1.2" />
          <rect x="8" y="156" width="300" height="96" fill={slab} stroke={ink} strokeWidth="1.2" />
          <line x1="184" y1="8" x2="184" y2="156" stroke={ink} strokeWidth="1.2" />
          <rect x="46" y="12" width="24" height="228" fill={drive} />
          <rect x="46" y="26" width="130" height="24" fill={drive} />
          <rect x="46" y="86" width="130" height="24" fill={drive} />
          <rect x="128" y="12" width="24" height="144" fill={drive} />
          <rect x="46" y="170" width="210" height="24" fill={drive} />
          <text x="88" y="40" fontSize="3.2" fill={ink} fontWeight="700">TWO-WAY</text>
          <text x="130" y="184" fontSize="3.2" fill={ink} fontWeight="700">WING AISLE · TWO-WAY</text>
          <rect x="10" y="104" width="36" height="52" fill={dark ? "#3a3f46" : "#c6c2ba"} stroke={ink} strokeWidth="0.4" />
          <text x="28" y="132" textAnchor="middle" fontSize="3" fill="#6b6456">RAMP ABOVE</text>
          <rect x="80" y="114" width="44" height="42" fill={dark ? "#152033" : "#cfc6b2"} stroke={ink} strokeWidth="0.8" />
          <text x="102" y="134" textAnchor="middle" fontSize="3.6" fontWeight="700" fill={dark ? "#e8c547" : ink}>ELEV LOBBY</text>
          <text x="102" y="140" textAnchor="middle" fontSize="3" fill={dark ? "#e8c547" : ink}>STAIR</text>
          {three ? (
            <>
              <text x="110" y="58" textAnchor="middle" fontSize="8" fontWeight="800" fill="#c9a227">X</text>
              <text x="110" y="63" textAnchor="middle" fontSize="2.8" fontWeight="700" fill="#c9a227">YOU ARE HERE</text>
            </>
          ) : null}
          <rect x="256" y="156" width="44" height="96" fill={three ? "#d7c9a3" : "#c9a227"} stroke={ink} strokeWidth="0.8" />
          <text x="278" y="188" textAnchor="middle" fontSize="3.6" fontWeight="700" fill={ink}>VEHICLE</text>
          <text x="278" y="194" textAnchor="middle" fontSize="3.6" fontWeight="700" fill={ink}>ELEVATOR</text>
          <text x="278" y="202" textAnchor="middle" fontSize="3" fill={ink}>MACHINE / CAB</text>
          {!three ? <text x="278" y="214" textAnchor="middle" fontSize="3.4" fontWeight="800" fill={ink}>I'M HERE</text> : null}
          <text x="278" y="240" textAnchor="middle" fontSize="2.8" fill={ink}>RAMP / LIFT</text>
          <circle cx="102" cy="157" r="1.6" fill="#c45a12" />
          <circle cx="278" cy="244" r="1.6" fill="#c45a12" />
          <text x="106" y="158" fontSize="2.6" fill="#c45a12" fontWeight="700">FE</text>
          <text x="281" y="245" fontSize="2.6" fill="#c45a12" fontWeight="700">FE</text>
          {layout.map((p) => {
            const s = p.live ? byId(p.id) : undefined;
            const sample = sampleCar(p.id);
            const job = working[p.id];
            const occupied = job ? true : s ? Boolean(s.plate) : sample.taken;
            const isDest = dest === p.id;
            const active = sel === p.id || highlight === p.id || isDest || hitIds.has(p.id);
            const fill = job ? (job.mine ? "#9b1c1c" : "#1d4e89") : isDest ? "#16a34a" : fillFor(occupied);
            const tipText = job
              ? `${job.valet} · ${job.car} · ${job.plate}`
              : occupied
                ? s?.plate
                  ? `${s.car ?? "Vehicle"} · ${s.plate}`
                  : `${sample.car} · ${sample.plate}`
                : "";
            return (
              <g
                key={`${level}-${p.id}-${p.x}-${p.y}`}
                onClick={() => p.live && onPick(p.id)}
                onMouseEnter={(event) => tipText && showTip(event, tipText)}
                onMouseMove={(event) => tipText && showTip(event, tipText)}
                onMouseLeave={() => setTip(null)}
                className="cursor-pointer"
              >
                <rect className={job ? (job.mine ? "valet-working" : "valet-other") : isDest ? "dest-stall" : undefined} x={p.x + 8} y={p.y + 8} width={p.w} height={p.h} fill={fill} stroke={active ? "#e8c547" : ink} strokeWidth={active ? 0.7 : 0.28} />
                <line x1={p.x + 8} y1={p.y + 8} x2={p.x + 8 + p.w} y2={p.y + 8 + p.h} stroke="rgba(21,32,51,0.22)" strokeWidth="0.18" />
                <line x1={p.x + 8 + p.w} y1={p.y + 8} x2={p.x + 8} y2={p.y + 8 + p.h} stroke="rgba(21,32,51,0.22)" strokeWidth="0.18" />
                {p.live ? (
                  <text x={p.x + 8 + p.w / 2} y={p.y + 8 + Math.min(4.2, p.h / 2 + 1)} textAnchor="middle" fontSize="2.4" fontWeight="700" fill={occupied && !isDest ? "#f4efe4" : ink}>{p.id}</text>
                ) : null}
              </g>
            );
          })}
          <text x="90" y="14" textAnchor="middle" fontSize="3" fill="#6b6456" fontWeight="700">NORTH BLOCK</text>
          <text x="24" y="256" fontSize="3" fill="#6b6456">WEST</text>
          <text x="140" y="256" fontSize="3" fill="#6b6456">SOUTH</text>
          <text x="278" y="256" textAnchor="middle" fontSize="3" fill="#c9a227" fontWeight="700">DIVISION · VE</text>
        </svg>
        {tip ? (
          <div
            className="pointer-events-none absolute z-10 max-w-48 rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold text-cream shadow-lg"
            style={{ left: tip.x, top: tip.y }}
          >
            {tip.text}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function GarageMap({
  tone = "light", highlight, dest, onPick, compact, prominent, hideSearch, hidePlates, onSelectStall,
}: {
  tone?: "light" | "dark"; highlight?: string; dest?: string; onPick?: (stallId: string) => void; compact?: boolean;
  prominent?: boolean; hideSearch?: boolean; hidePlates?: boolean; onSelectStall?: (stallId: string) => void;
}) {
  const tickets = useLane((s) => s.tickets);
  const stalls = occupancy(tickets);
  const working = useMemo(() => workingOn(tickets), [tickets]);
  const [q, setQ] = useState("");
  const hits = searchDeck(q, stalls, tickets);
  const hitIds = new Set(hits.map((h) => h.stallId).filter(Boolean) as string[]);
  const [sel, setSel] = useState<string | null>(highlight ?? null);
  const dark = tone === "dark";
  const onSelectRef = useMemo(() => ({ current: onSelectStall }), []);
  onSelectRef.current = onSelectStall;
  useEffect(() => {
    if (!q.trim()) return;
    const first = searchDeck(q, occupancy(tickets), tickets).find((h) => h.stallId)?.stallId;
    if (first) {
      setSel(first);
      onSelectRef.current?.(first);
    }
  }, [q, tickets, onSelectRef]);
  const stall = stalls.find((s) => s.id === sel) ?? stalls.find((s) => s.id === highlight);
  function pick(id: string) { setSel(id); onPick?.(id); onSelectStall?.(id); }
  return (
    <div className="space-y-4">
      {compact || hideSearch ? null : prominent ? (
        <section className={cn("rounded-2xl border-2 border-gold bg-white p-4 text-navy", dark && "border-gold bg-navy-2 text-cream")}>
          <p className="font-display text-2xl text-navy">Find a car</p>
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute top-5 left-4 size-5 text-navy" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Make, model, plate or stall — e.g. Tesla, HST-4412, B-14"
              autoComplete="off"
              className="h-16 w-full rounded-full border-2 border-navy bg-cream pr-4 pl-12 text-xl text-navy placeholder:text-muted"
            />
          </label>
          {q.trim() ? (
            <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
              {hits.length ? hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => h.stallId && pick(h.stallId)} className={cn("flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left", sel === h.stallId ? "bg-gold text-navy" : "bg-cream text-navy")}>
                    <span className="min-w-0">
                      <span className="block font-display text-xl">{h.where}</span>
                      <span className="block text-sm">{h.car} · {h.plate}{h.unit ? ` · APT ${h.unit}` : ""}</span>
                    </span>
                  </button>
                </li>
              )) : <li className="px-1 py-2 text-sm text-muted">Nothing on the deck matches.</li>}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-muted">Car search. Green is open. Dark is taken. Red is your car. Blue is another valet.</p>
          {stall ? (
            <p className="mt-1 text-xs text-muted">
              {stall.plate ? `${stall.id} · ${[stall.car, stall.color].filter(Boolean).join(" · ")} · ${stall.plate}${stall.blockedBy ? ` · nested behind ${stall.blockedBy}` : ""}` : `${stall.id} open`}
            </p>
          ) : null}
        </section>
      ) : (
        <section className={cn("rounded-2xl border p-4", dark ? "border-navy-2 bg-navy-2/40 text-cream" : "border-line bg-white text-navy")}>
          <p className="font-display text-2xl">Car search</p>
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
      {hidePlates ? null : <Plate level="3B" stalls={stalls} sel={sel} highlight={highlight} dest={dest} hitIds={hitIds} onPick={pick} dark={dark} working={working} />}
      {hidePlates ? null : <Plate level="2B" stalls={stalls} sel={sel} highlight={highlight} dest={dest} hitIds={hitIds} onPick={pick} dark={dark} working={working} />}
    </div>
  );
}
