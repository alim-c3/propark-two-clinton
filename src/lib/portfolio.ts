/** Regional book. Demo garages are sample data. Live uses the Two Clinton board. */

export const CARS_PER_VALET_HR = 10;

export type RangeKey = "now" | "today" | "week";
export type WindowKey = "morning" | "midday" | "evening";
export type Band = "ok" | "watch" | "short";
export type SiteMode = "demo" | "live";

export type Slice = {
  occupied: number;
  valets: number;
  demand: number;
  demandLabel: string;
  retrievalAvg: number;
  retrievalP90: number;
  openTickets: number;
  incidents: number;
};

export type Garage = {
  id: string;
  name: string;
  place: string;
  stalls: number;
  sla: number;
  /** Sample dollars per stall per month. Not a bill. */
  yield: number;
  zones: { hot: number; warm: number; cold: number; stack: number };
  hourly: { hour: string; pulls: number }[];
  cred: { unit: string; score: number; note: string }[];
  notes: { when: string; text: string }[];
  fit: string;
  windows: Record<WindowKey, Slice>;
  today: Slice;
  week: Slice;
};

const LIVE_ROOTS = new Set(["runwaygarage.com", "residentrunway.com"]);

export function siteModeFromHost(host: string | null | undefined): SiteMode {
  const raw = (host ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  const name = raw.split(":")[0]?.replace(/^www\./, "") ?? "";
  if (LIVE_ROOTS.has(name) || name.endsWith(".runwaygarage.com")) return "live";
  return "demo";
}

export function nyClock(now = Date.now()): { hour: number; label: string; window: WindowKey } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const label = `${h12}${hour < 12 ? "a" : "p"}`;
  const window: WindowKey =
    hour >= 6 && hour < 10 ? "morning" : hour >= 15 && hour < 19 ? "evening" : "midday";
  return { hour, label, window };
}

export function healthScore(input: {
  retrievalP90: number;
  sla: number;
  occupancy: number;
  demand: number;
  valets: number;
  incidents: number;
}): number {
  const slaHit = Math.min(1, input.sla / Math.max(1, input.retrievalP90));
  const occ = input.occupancy;
  const occHit =
    occ >= 0.68 && occ <= 0.92 ? 1 : Math.max(0, 1 - Math.abs(occ - 0.8) / 0.35);
  const cap = Math.max(1, input.valets * CARS_PER_VALET_HR);
  const util = input.demand / cap;
  const utilHit = util <= 1 ? Math.min(1, util / 0.5) : Math.max(0, 1 - (util - 1) * 1.6);
  const incHit = Math.max(0, 1 - input.incidents * 0.28);
  return Math.round(Math.min(100, Math.max(0, slaHit * 40 + occHit * 20 + utilHit * 25 + incHit * 15)));
}

export function bandOf(score: number): Band {
  if (score >= 80) return "ok";
  if (score >= 65) return "watch";
  return "short";
}

export function sliceFor(garage: Garage, range: RangeKey, window: WindowKey): Slice {
  if (range === "today") return garage.today;
  if (range === "week") return garage.week;
  return garage.windows[window];
}

export type Scored = Garage & {
  slice: Slice;
  valets: number;
  occupancy: number;
  health: number;
  band: Band;
  capacity: number;
};

export function scoreGarage(garage: Garage, range: RangeKey, window: WindowKey, extraValets = 0): Scored {
  const slice = sliceFor(garage, range, window);
  const valets = Math.max(1, slice.valets + extraValets);
  const occupancy = slice.occupied / garage.stalls;
  const health = healthScore({
    retrievalP90: slice.retrievalP90,
    sla: garage.sla,
    occupancy,
    demand: slice.demand,
    valets,
    incidents: slice.incidents,
  });
  return {
    ...garage,
    slice,
    valets,
    occupancy,
    health,
    band: bandOf(health),
    capacity: valets * CARS_PER_VALET_HR,
  };
}

export type Call = { action: "move" | "hold"; title: string; body: string; done: string };

export function portfolioCall(range: RangeKey, window: WindowKey): Call {
  if (range === "week") {
    return {
      action: "move",
      title: "360 Huguenot has missed the 8a line four mornings this week.",
      body: "Typical 8a is 24 pulls on 2 valets (20 cars/hr). One Clinton Park’s morning peak is 13 on 3 valets. Move one valet to 360 Huguenot before 7:30a. Two Clinton holds four — 42 against 40, on the line, not the miss.",
      done: "Staged for the demo. 360 Huguenot can take 30 cars an hour. One Clinton Park still covers a 13-car peak.",
    };
  }
  if (range === "today" || (range === "now" && window === "morning")) {
    return {
      action: "move",
      title: "Move 1 valet from One Clinton Park to 360 Huguenot before 8a.",
      body: "360 Huguenot peaks at 26 pulls with 2 valets (20 cars/hr). One Clinton Park peaks at 14 and can give one up. Two Clinton is on the line at 45 vs 40 — leave those four where they are.",
      done: "Staged for the demo. 360 Huguenot can take 30 cars an hour. One Clinton Park still covers 14. Two Clinton stays at four. Nothing was sent to a live crew.",
    };
  }
  if (window === "evening") {
    return {
      action: "hold",
      title: "Evening return is covered if 360 Huguenot keeps the morning add.",
      body: "5p is 16 pulls at 360 Huguenot (20 cars/hr on 2, 30 if you moved someone). Two Clinton’s 5p is 14 against 40. Don’t pull a valet off Two Clinton for this.",
      done: "Crews stay. 360 Huguenot’s 5p is inside capacity.",
    };
  }
  return {
    action: "hold",
    title: "Leave the crews. 360 Huguenot’s stack is the problem, not the headcount.",
    body: "Midday pulls are under capacity at all three. 360 Huguenot is about 95% full and the stack is full. Next park-down stays off the lower deck until a retrieval clears it.",
    done: "No move. A spare valet does not free a stacker.",
  };
}

const day = (rows: number[]): { hour: string; pulls: number }[] => {
  const labels = ["6a", "7a", "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p"];
  return labels.map((hour, i) => ({ hour, pulls: rows[i] ?? 0 }));
};

export const DEMO_GARAGES: Garage[] = [
  {
    id: "tcp",
    name: "Two Clinton Park",
    place: "New Rochelle",
    stalls: 174,
    sla: 10,
    yield: 168,
    zones: { hot: 92, warm: 84, cold: 71, stack: 66 },
    hourly: day([8, 22, 45, 16, 9, 7, 6, 5, 4, 6, 10, 14, 12, 7, 4]),
    cred: [
      { unit: "702", score: 94, note: "On time. Standing Thursday is clean." },
      { unit: "1512", score: 41, note: "Two no-shows this month. Requests wait." },
    ],
    notes: [
      { when: "8:12a", text: "1512 waited 14 min. Audi on B-13 was nosed in." },
    ],
    fit: "8a cars are already in hot. Don’t restack them before 9.",
    windows: {
      morning: { occupied: 150, valets: 4, demand: 45, demandLabel: "8a", retrievalAvg: 8.4, retrievalP90: 12, openTickets: 11, incidents: 1 },
      midday: { occupied: 142, valets: 3, demand: 4, demandLabel: "2p", retrievalAvg: 6.1, retrievalP90: 9, openTickets: 3, incidents: 0 },
      evening: { occupied: 155, valets: 4, demand: 14, demandLabel: "5p", retrievalAvg: 7.2, retrievalP90: 11, openTickets: 6, incidents: 0 },
    },
    today: { occupied: 148, valets: 4, demand: 45, demandLabel: "8a peak", retrievalAvg: 8.1, retrievalP90: 12, openTickets: 11, incidents: 1 },
    week: { occupied: 136, valets: 4, demand: 42, demandLabel: "typical 8a", retrievalAvg: 7.4, retrievalP90: 11, openTickets: 4, incidents: 0 },
  },
  {
    id: "one",
    name: "One Clinton Park",
    place: "New Rochelle",
    stalls: 128,
    sla: 10,
    yield: 121,
    zones: { hot: 70, warm: 61, cold: 48, stack: 22 },
    hourly: day([2, 8, 14, 9, 6, 4, 3, 3, 3, 4, 6, 8, 6, 3, 2]),
    cred: [{ unit: "814", score: 88, note: "Steady. No cancels this week." }],
    notes: [{ when: "Today", text: "No incidents this shift." }],
    fit: "Warm row can take 11 more cars without touching a stacker.",
    windows: {
      morning: { occupied: 84, valets: 3, demand: 14, demandLabel: "8a", retrievalAvg: 4.8, retrievalP90: 7, openTickets: 2, incidents: 0 },
      midday: { occupied: 78, valets: 2, demand: 3, demandLabel: "2p", retrievalAvg: 4.4, retrievalP90: 6, openTickets: 1, incidents: 0 },
      evening: { occupied: 90, valets: 2, demand: 8, demandLabel: "5p", retrievalAvg: 5.1, retrievalP90: 8, openTickets: 2, incidents: 0 },
    },
    today: { occupied: 86, valets: 3, demand: 14, demandLabel: "8a peak", retrievalAvg: 5, retrievalP90: 7, openTickets: 2, incidents: 0 },
    week: { occupied: 80, valets: 3, demand: 13, demandLabel: "typical 8a", retrievalAvg: 5.2, retrievalP90: 8, openTickets: 2, incidents: 0 },
  },
  {
    id: "huguenot",
    name: "360 Huguenot",
    place: "New Rochelle",
    stalls: 96,
    sla: 10,
    yield: 204,
    zones: { hot: 100, warm: 96, cold: 88, stack: 100 },
    hourly: day([3, 12, 26, 11, 5, 3, 2, 2, 3, 5, 9, 16, 11, 4, 2]),
    cred: [{ unit: "1902", score: 38, note: "Cancels inside 5 min. Pulls start, then die." }],
    notes: [
      { when: "7:51a", text: "Lower deck blocked. Retrieval ran 19 min." },
      { when: "Now", text: "Stack is full. Next park-down waits or takes warm." },
    ],
    fit: "Stop park-downs onto the lower deck until a retrieval clears it.",
    windows: {
      morning: { occupied: 91, valets: 2, demand: 26, demandLabel: "8a", retrievalAvg: 13.5, retrievalP90: 18, openTickets: 8, incidents: 2 },
      midday: { occupied: 90, valets: 2, demand: 3, demandLabel: "2p", retrievalAvg: 8, retrievalP90: 12, openTickets: 2, incidents: 1 },
      evening: { occupied: 92, valets: 2, demand: 16, demandLabel: "5p", retrievalAvg: 9.4, retrievalP90: 14, openTickets: 5, incidents: 1 },
    },
    today: { occupied: 91, valets: 2, demand: 26, demandLabel: "8a peak", retrievalAvg: 12.8, retrievalP90: 18, openTickets: 8, incidents: 2 },
    week: { occupied: 88, valets: 2, demand: 24, demandLabel: "typical 8a", retrievalAvg: 11.6, retrievalP90: 16, openTickets: 5, incidents: 1 },
  },
];

export const MOVE = { from: "one", to: "huguenot", count: 1 } as const;
