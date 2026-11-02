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
  fact: {
    client: string;
    kind: string;
    scheduled: number;
    showed: string[];
    noCall: string[];
    blocker: string | null;
    claim: string;
    redSince: string | null;
  };
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

export function nyClock(now = Date.now()): { hour: number; minute: number; label: string; window: WindowKey } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const label = `${h12}${hour < 12 ? "a" : "p"}`;
  const window: WindowKey = hour >= 6 && hour < 10 ? "morning" : hour >= 15 && hour < 19 ? "evening" : "midday";
  return { hour, minute, label, window };
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

export type Call = {
  action: "hold" | "send" | "plan";
  title: string;
  body: string;
  fixes: string;
  doesNot: string;
  done: string;
};

export function portfolioCall(range: RangeKey, window: WindowKey): Call {
  if (range === "week") {
    return {
      action: "plan",
      title: "Four misses. A valet fixes two of them.",
      body: "Mon and Wed the lower deck was blocked. Tue and Thu Maya and Andre no-called. Fri held. Ana walks from One Clinton in 2 minutes. That is a no-call morning, not a deck morning.",
      fixes: "Tue and Thu were headcount. Ana covers one of those mornings. One Clinton still has two valets for 14 cars.",
      doesNot: "Mon and Wed were the deck. The curb stays past 10 minutes until a car comes off the lower deck.",
      done: "Tomorrow is set. Ana leaves One Clinton at 7:30a. The deck is still blocked. Not sent to a live crew.",
    };
  }
  if (window === "morning") {
    return {
      action: "send",
      title: "Send Ana. The deck is still blocked.",
      body: "45 cars at 8a. Five were scheduled at Two Clinton. Luis, Derrick, and Chris showed. Maya and Andre no-called. Ana is at the sister tower, 2 minutes away. 360 Huguenot is a separate crew. Do not pull them.",
      fixes: "Four valets. 40 cars an hour. The wave is still 5 cars short.",
      doesNot: "The curb stays at 18 minutes. The lower deck stays blocked. Yellow is not fixed.",
      done: "Ana is on the Two Clinton count. 40 cars an hour against 45. The curb is still 18 minutes. The deck is still blocked.",
    };
  }
  if (window === "evening") {
    return {
      action: "hold",
      title: "The return fits. The curb does not.",
      body: "5p is 18 cars. Three valets cover it at 30 an hour. Don’t pull Ana for a wave that already fits. The lower deck has been blocked since 7:51a, and that is why residents are still waiting.",
      fixes: "Leave the crews. Park-downs stay off the lower deck.",
      doesNot: "Sending a person does not clear a stacker. The 10-minute promise is still missed.",
      done: "Crews stay. Park-downs held off the lower deck. Two Clinton is still past the promise.",
    };
  }
  const today = range === "today";
  return {
    action: "hold",
    title: "Don't send Ana. The lower deck is blocked.",
    body: today
      ? "8a already missed. Five scheduled, three showed, and the deck was blocked before the wave. That hour is over. This hour fits the crew. Mon and Wed were the deck. Tue and Thu were no-calls."
      : "This hour fits the crew. The lower deck is blocked, and a retrieval already ran 19 minutes. A valet will not free it.",
    fixes: "Park-downs stay off the lower deck until a car comes out.",
    doesNot: "Ana before 7:30a fixes a no-call morning. She does not fix the deck, and she does not pull the curb back to 10.",
    done: "Held. Next park-down stays off the lower deck. Two Clinton stays red until a car comes out.",
  };
}

const day = (rows: number[]): { hour: string; pulls: number }[] => {
  const labels = ["5a", "6a", "7a", "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p"];
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
    zones: { hot: 98, warm: 94, cold: 86, stack: 100 },
    hourly: day([3, 8, 22, 45, 16, 9, 7, 6, 5, 4, 6, 10, 14, 12, 7, 4, 2, 2, 1]),
    cred: [
      { unit: "702", score: 94, note: "On time. Standing Thursday is clean." },
      { unit: "1512", score: 41, note: "Two no-shows this month. Requests wait." },
    ],
    notes: [
      { when: "7:51a", text: "Lower deck blocked. Retrieval ran 19 min." },
      { when: "8:12a", text: "1512 waited 14 min. Audi on B-13 was nosed in." },
      { when: "Now", text: "Stack is full. Next park-down waits or takes warm." },
    ],
    fit: "Stop park-downs onto the lower deck until a retrieval clears it.",
    fact: {
      client: "RXR",
      kind: "Residential retrieval",
      scheduled: 5,
      showed: ["Luis", "Derrick", "Chris"],
      noCall: ["Maya", "Andre"],
      blocker: "Lower deck blocked. A retrieval took 19 min.",
      claim: "Long wait. No damage claim.",
      redSince: "7:51a",
    },
    windows: {
      morning: { occupied: 158, valets: 3, demand: 45, demandLabel: "8a", retrievalAvg: 13.5, retrievalP90: 18, openTickets: 12, incidents: 2 },
      midday: { occupied: 166, valets: 3, demand: 6, demandLabel: "2p", retrievalAvg: 11, retrievalP90: 16, openTickets: 6, incidents: 1 },
      evening: { occupied: 166, valets: 3, demand: 18, demandLabel: "5p", retrievalAvg: 12.4, retrievalP90: 18, openTickets: 8, incidents: 2 },
    },
    today: { occupied: 160, valets: 3, demand: 45, demandLabel: "8a peak", retrievalAvg: 13.2, retrievalP90: 18, openTickets: 12, incidents: 2 },
    week: { occupied: 158, valets: 3, demand: 42, demandLabel: "typical 8a", retrievalAvg: 12.6, retrievalP90: 17, openTickets: 8, incidents: 2 },
  },
  {
    id: "one",
    name: "One Clinton Park",
    place: "New Rochelle",
    stalls: 128,
    sla: 10,
    yield: 121,
    zones: { hot: 70, warm: 61, cold: 48, stack: 22 },
    hourly: day([1, 2, 8, 14, 9, 6, 4, 3, 3, 3, 4, 6, 8, 6, 3, 2, 1, 1, 0]),
    cred: [{ unit: "814", score: 88, note: "Steady. No cancels this week." }],
    notes: [{ when: "Today", text: "No incidents this shift." }],
    fit: "Warm row can take 11 more cars without touching a stacker.",
    fact: {
      client: "RXR",
      kind: "Residential retrieval",
      scheduled: 3,
      showed: ["Ana", "Sam", "Priya"],
      noCall: [],
      blocker: null,
      claim: "No open claim.",
      redSince: null,
    },
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
    zones: { hot: 78, warm: 70, cold: 55, stack: 40 },
    hourly: day([2, 3, 12, 26, 11, 5, 3, 2, 2, 3, 5, 9, 16, 11, 4, 2, 1, 1, 0]),
    cred: [{ unit: "1902", score: 88, note: "Steady. No cancels this week." }],
    notes: [{ when: "Today", text: "No incidents this shift." }],
    fit: "8a is inside the crew. Hot row still has room.",
    fact: {
      client: "RXR",
      kind: "Residential retrieval",
      scheduled: 3,
      showed: ["Jordan", "Elena", "Matt"],
      noCall: [],
      blocker: null,
      claim: "No open claim.",
      redSince: null,
    },
    windows: {
      morning: { occupied: 78, valets: 3, demand: 26, demandLabel: "8a", retrievalAvg: 6.2, retrievalP90: 8, openTickets: 2, incidents: 0 },
      midday: { occupied: 74, valets: 2, demand: 3, demandLabel: "2p", retrievalAvg: 5.4, retrievalP90: 7, openTickets: 1, incidents: 0 },
      evening: { occupied: 80, valets: 3, demand: 11, demandLabel: "5p", retrievalAvg: 6.1, retrievalP90: 8, openTickets: 2, incidents: 0 },
    },
    today: { occupied: 78, valets: 3, demand: 26, demandLabel: "8a peak", retrievalAvg: 6.4, retrievalP90: 8, openTickets: 2, incidents: 0 },
    week: { occupied: 76, valets: 3, demand: 22, demandLabel: "typical 8a", retrievalAvg: 6.2, retrievalP90: 8, openTickets: 2, incidents: 0 },
  },
];

export const MOVE = { from: "one", to: "tcp", count: 1 } as const;

export const MORNINGS = [
  { day: "Mon", why: "Deck" },
  { day: "Tue", why: "No-call" },
  { day: "Wed", why: "Deck" },
  { day: "Thu", why: "No-call" },
  { day: "Fri", why: "Held" },
] as const;
