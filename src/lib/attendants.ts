import type { Punch, ShiftPull, StaffName, Ticket } from "./types";

const T0 = Date.now();

function today(h: number, m: number) {
  const d = new Date(T0);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export const ROSTER: {
  id: StaffName;
  desk: string;
}[] = [
  { id: "Luis", desk: "Lead · Cabinet 07" },
  { id: "Derrick", desk: "P2 floor" },
  { id: "Ana", desk: "AM wave" },
  { id: "You", desk: "Relief · P2" },
];

export const INITIAL_PUNCHES: Punch[] = [
  { who: "Ana", kind: "in", at: today(5, 50) },
  { who: "Ana", kind: "break-start", at: today(9, 40) },
  { who: "Ana", kind: "break-end", at: today(10, 0) },
  { who: "Ana", kind: "break-start", at: today(12, 12) },
  { who: "Ana", kind: "break-end", at: today(12, 32) },
  { who: "Ana", kind: "out", at: today(14, 5) },
  { who: "Derrick", kind: "in", at: today(13, 45) },
  { who: "Luis", kind: "in", at: today(14, 0) },
  { who: "Luis", kind: "break-start", at: today(15, 12) },
  { who: "Luis", kind: "break-end", at: today(15, 30) },
  { who: "Derrick", kind: "break-start", at: today(15, 40) },
  { who: "Derrick", kind: "break-end", at: today(16, 2) },
];

function pull(
  who: StaffName,
  h: number,
  m: number,
  unit: string,
  car: string,
  plate: string,
  stall: string,
  mins: number,
  nest?: boolean,
): ShiftPull {
  return { who, unit, car, plate, stall, mins, nest, at: today(h, m) };
}

export const INITIAL_PULLS: ShiftPull[] = [
  pull("Ana", 6, 12, "1204", "Civic", "NYR-4410", "A-03", 6),
  pull("Ana", 6, 28, "808", "Rav4", "TOY-808", "C-02", 7),
  pull("Ana", 6, 47, "618", "GLC", "MB-618", "A-06", 8, true),
  pull("Ana", 7, 4, "1008", "Ioniq 5", "EV-1902", "C-01", 5),
  pull("Ana", 7, 9, "512", "Highlander", "TOY-512", "B-19", 11, true),
  pull("Ana", 7, 14, "909", "3-series", "BMW-909", "A-05", 7),
  pull("Ana", 7, 18, "406", "XC60", "VOL-406", "A-02", 6),
  pull("Ana", 7, 22, "803", "Bolt", "EV-0803", "C-04", 5),
  pull("Ana", 8, 1, "318", "Kona", "HYN-318", "C-06", 6),
  pull("Ana", 8, 16, "1410", "Golf", "VW-1410", "P-02", 7),
  pull("Ana", 8, 44, "203", "Tahoe", "CHEV-203", "B-22", 10, true),
  pull("Ana", 10, 18, "714", "CX-5", "MZD-714", "B-18", 8),
  pull("Ana", 11, 2, "guest", "Wrangler", "JEEP-1", "R-01", 4),
  pull("Ana", 11, 41, "608", "Camry", "CAM-608", "B-12", 7),
  pull("Ana", 12, 58, "808", "Rav4", "TOY-808", "C-02", 6),
  pull("Ana", 13, 22, "1204", "Civic", "NYR-4410", "A-03", 5),

  pull("Derrick", 13, 58, "714", "CX-5", "MZD-714", "B-18", 8),
  pull("Derrick", 14, 16, "909", "3-series", "BMW-909", "A-05", 7),
  pull("Derrick", 14, 38, "guest", "Wrangler", "JEEP-1", "P-06", 4),
  pull("Derrick", 15, 12, "203", "Tahoe", "CHEV-203", "B-22", 10, true),
  pull("Derrick", 15, 34, "1410", "Golf", "VW-1410", "P-02", 6),
  pull("Derrick", 15, 49, "608", "Camry", "CAM-608", "B-12", 7),
  pull("Derrick", 16, 6, "318", "Kona", "HYN-318", "C-06", 5),

  pull("Luis", 14, 11, "1204", "Civic", "NYR-4410", "A-03", 6),
  pull("Luis", 14, 29, "905", "Outback", "SUB-1904", "C-02", 8),
  pull("Luis", 14, 47, "618", "GLC", "MB-618", "A-06", 7, true),
  pull("Luis", 15, 8, "803", "Bolt", "EV-0803", "C-04", 5),
  pull("Luis", 15, 31, "1102", "Accord", "HND-1102", "B-16", 9, true),
  pull("Luis", 15, 52, "406", "XC60", "VOL-406", "A-02", 6),
  pull("Luis", 16, 4, "guest", "Q3", "AUD-512", "R-01", 5),
];

export type FloorStatus = "on" | "break" | "off";

export type AttendantRollup = {
  id: StaffName;
  desk: string;
  status: FloorStatus;
  onMin: number;
  breakMin: number;
  cars: number;
  cph: number | null;
  avgMin: number | null;
  longest: number | null;
  nests: number;
  clockIn?: number;
  clockOut?: number;
  lastBreak?: number;
  hours: { hour: string; n: number }[];
  pulls: ShiftPull[];
  current?: Ticket;
};

function hourLabel(ts: number) {
  const h = new Date(ts).getHours();
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

function duty(who: StaffName, punches: Punch[], now: number) {
  const events = punches.filter((p) => p.who === who).sort((a, b) => a.at - b.at);
  let mode: FloorStatus = "off";
  let last = 0;
  let onMin = 0;
  let breakMin = 0;
  let clockIn: number | undefined;
  let clockOut: number | undefined;
  let lastBreak: number | undefined;
  for (const e of events) {
    if (mode === "on") onMin += Math.max(0, e.at - last);
    if (mode === "break") breakMin += Math.max(0, e.at - last);
    if (e.kind === "in") {
      mode = "on";
      clockIn = clockIn ?? e.at;
      clockOut = undefined;
    } else if (e.kind === "break-start") {
      mode = "break";
      lastBreak = e.at;
    } else if (e.kind === "break-end") {
      mode = "on";
    } else {
      mode = "off";
      clockOut = e.at;
    }
    last = e.at;
  }
  if (mode === "on") onMin += Math.max(0, now - last);
  if (mode === "break") breakMin += Math.max(0, now - last);
  return {
    status: mode,
    onMin: Math.round(onMin / 60000),
    breakMin: Math.round(breakMin / 60000),
    clockIn,
    clockOut,
    lastBreak,
  };
}

export function rollupAttendant(
  id: StaffName,
  punches: Punch[],
  pulls: ShiftPull[],
  tickets: Ticket[],
  now = Date.now(),
): AttendantRollup {
  const desk = ROSTER.find((r) => r.id === id)?.desk ?? "";
  const times = duty(id, punches, now);
  const mine = pulls.filter((p) => p.who === id).sort((a, b) => b.at - a.at);
  const cars = mine.length;
  const avgMin =
    cars === 0 ? null : Math.round(mine.reduce((s, p) => s + p.mins, 0) / cars);
  const longest = cars === 0 ? null : Math.max(...mine.map((p) => p.mins));
  const nests = mine.filter((p) => p.nest).length;
  const hoursOn = times.onMin / 60;
  const cph = cars === 0 || hoursOn < 0.15 ? null : Math.round((cars / hoursOn) * 10) / 10;
  const hourMap = new Map<string, number>();
  for (const p of mine) {
    const k = hourLabel(p.at);
    hourMap.set(k, (hourMap.get(k) ?? 0) + 1);
  }
  const hours = [...hourMap.entries()].map(([hour, n]) => ({ hour, n })).reverse();
  const current = tickets.find(
    (t) =>
      t.valet === id &&
      (t.status === "claimed" || t.status === "staged"),
  );
  return {
    id,
    desk,
    ...times,
    cars,
    cph,
    avgMin,
    longest,
    nests,
    hours,
    pulls: mine,
    current,
  };
}

export function rollupFloor(
  punches: Punch[],
  pulls: ShiftPull[],
  tickets: Ticket[],
  now = Date.now(),
) {
  const rows = ROSTER.map((r) => rollupAttendant(r.id, punches, pulls, tickets, now));
  const rank: Record<FloorStatus, number> = { on: 0, break: 1, off: 2 };
  return rows.sort((a, b) => rank[a.status] - rank[b.status]);
}
