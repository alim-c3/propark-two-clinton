import type { ChatMsg, Contact, RestackMove, RidePing, Stall, Ticket } from "./types";

const T0 = Date.now();

export const RESIDENT = {
  unit: "702",
  name: "Priya Nair",
  floor: "7",
  plan: "A1M · 1 bed",
  car: "Tesla Y",
  color: "White",
  plate: "HST-4412",
  stall: "B-14",
  charge: 74,
  keys: "Cabinet 07",
  standing: "Thu 7:05",
  email: "priya.nair@icloud.com",
  phone: "(914) 555-0142",
};

export const CONTACTS: Contact[] = [
  { unit: "702", name: "Priya Nair", email: "priya.nair@icloud.com", phone: "(914) 555-0142" },
  { unit: "308", name: "Ravi Patel", email: "r.patel@gmail.com", phone: "(914) 555-0198" },
  { unit: "414", name: "Elena Rossi", email: "elena.r@me.com", phone: "(917) 555-0110" },
  { unit: "PH4", name: "Jordan Blake", email: "jblake@icloud.com", phone: "(646) 555-0177" },
  { unit: "210", name: "Alvarez", email: "alvarez210@outlook.com", phone: "(914) 555-0164" },
  { unit: "1512", name: "Mei Chen", email: "mei.chen@gmail.com", phone: "(917) 555-0133" },
  { unit: "1008", name: "Ada Okonkwo", email: "ada.okonkwo@icloud.com", phone: "(646) 555-0188" },
];

export function ridePingCopy(t: {
  car: string;
  plate: string;
  type: Ticket["type"];
  stall: string;
  toStall?: string;
}, kind: RidePing["kind"]) {
  const inbound = t.type === "arrival";
  if (kind === "getting") {
    return inbound
      ? `ProPark Runway: we’ve got your ${t.car} at the curb. Parking it now.`
      : `ProPark Runway: we’re getting your ${t.car} (${t.plate}). We’ll text when it’s ready on the runway.`;
  }
  return inbound
    ? `Parked in ${t.toStall ?? t.stall}. Keys in Cabinet 07.`
    : `Your car is ready on the runway. ${t.car} · ${t.plate} at Clinton Place curb. Come down when you’re ready.`;
}

export const INITIAL_RIDE_PINGS: RidePing[] = [];

export function keyRequestCopy(
  c: Contact,
  car?: { car: string; plate: string },
) {
  const first = c.name.split(" ")[0];
  const who = car
    ? `the ${car.car} (${car.plate}) · APT ${c.unit}`
    : `APT ${c.unit}`;
  return {
    sms: `ProPark Runway · Two Clinton: please bring keys for ${who} to Cabinet 07 in the lobby. We will not come upstairs. Reply YES when they’re in.`,
    emailSubject: `Keys needed at Cabinet 07 · ${who}`,
    emailBody: `Hi ${first},\n\nThe valet desk at Two Clinton Park needs the keys for ${who} brought to Cabinet 07 in the lobby. Nobody is coming upstairs.\n\nOpen Runway and tap to confirm, or drop them in the cabinet on your way out.\n\n— ProPark Runway · 50 Clinton Place`,
  };
}

function S(
  partial: Pick<Stall, "id" | "bay" | "zone" | "col"> & Partial<Stall>,
): Stall {
  return { ev: false, plate: null, ...partial };
}

export const STALLS: Stall[] = [
  S({ id: "R-01", bay: "guest", zone: "guest", col: 0 }),
  S({ id: "R-02", bay: "guest", zone: "guest", col: 1 }),
  S({ id: "A-01", bay: "hot", zone: "hot", col: 0, plate: "KLM-2291", unit: "308", car: "BMW X5", color: "Black" }),
  S({ id: "A-02", bay: "hot", zone: "hot", col: 1, ev: true }),
  S({ id: "A-03", bay: "hot", zone: "hot", col: 2 }),
  S({ id: "A-04", bay: "hot", zone: "hot", col: 3, plate: "Q5-4419", unit: "414", car: "Audi Q5", color: "Black" }),
  S({ id: "A-05", bay: "hot", zone: "hot", col: 4, ada: true }),
  S({ id: "A-06", bay: "hot", zone: "hot", col: 5, ev: true }),
  S({
    id: "B-11",
    bay: "mid",
    zone: "midAisle",
    col: 0,
    plate: "HND-0210",
    unit: "210",
    car: "Honda Pilot",
    color: "White",
  }),
  S({
    id: "B-13",
    bay: "mid",
    zone: "midAisle",
    col: 1,
    plate: "Q5-BLK",
    unit: "804",
    car: "Audi",
    color: "Black",
    blocks: "B-14",
  }),
  S({
    id: "B-15",
    bay: "mid",
    zone: "midAisle",
    col: 2,
    plate: "NYC-8821",
    unit: "1512",
    car: "Lexus RX",
    color: "Graphite",
  }),
  S({ id: "B-17", bay: "mid", zone: "midAisle", col: 3, plate: "JET-3301", unit: "511", car: "Forester", color: "Green", liftDeck: "upper", liftPair: "B-18" }),
  S({ id: "B-19", bay: "mid", zone: "midAisle", col: 4 }),
  S({ id: "B-21", bay: "mid", zone: "midAisle", col: 5, plate: "VAN-0199", unit: "909", car: "Odyssey", color: "Silver" }),
  S({ id: "B-12", bay: "mid", zone: "midWall", col: 0, ev: true }),
  S({
    id: "B-14",
    bay: "mid",
    zone: "midWall",
    col: 1,
    ev: true,
    plate: "HST-4412",
    unit: "702",
    car: "Tesla Y",
    color: "White",
    blockedBy: "B-13",
  }),
  S({ id: "B-16", bay: "mid", zone: "midWall", col: 2 }),
  S({ id: "B-18", bay: "mid", zone: "midWall", col: 3, liftDeck: "lower", liftPair: "B-17" }),
  S({ id: "B-20", bay: "mid", zone: "midWall", col: 4, plate: "WHT-5510", unit: "804", car: "Rav4", color: "White", liftDeck: "upper", liftPair: "B-22" }),
  S({ id: "B-22", bay: "mid", zone: "midWall", col: 5, liftDeck: "lower", liftPair: "B-20" }),
  S({
    id: "C-01",
    bay: "deep",
    zone: "deep",
    col: 0,
    ev: true,
    plate: "EV-1902",
    unit: "1008",
    car: "Ioniq 5",
    color: "Gray",
    liftDeck: "upper",
    liftPair: "C-02",
  }),
  S({ id: "C-02", bay: "deep", zone: "deep", col: 1, ev: true, liftDeck: "lower", liftPair: "C-01" }),
  S({
    id: "C-03",
    bay: "deep",
    zone: "deep",
    col: 2,
    plate: "BLK-2208",
    unit: "1202",
    car: "Camry",
    color: "Black",
    liftDeck: "lower",
    liftPair: "C-04",
  }),
  S({ id: "C-04", bay: "deep", zone: "deep", col: 3, liftDeck: "upper", liftPair: "C-03" }),
  S({
    id: "C-05",
    bay: "deep",
    zone: "deep",
    col: 4,
    plate: "GT-55",
    unit: "PH4",
    car: "Macan",
    color: "Gray",
    liftDeck: "upper",
    liftPair: "C-06",
  }),
  S({ id: "C-06", bay: "deep", zone: "deep", col: 5, liftDeck: "lower", liftPair: "C-05" }),
  S({
    id: "P-01",
    bay: "permit",
    zone: "permit",
    col: 0,
    plate: "50-C-018",
    unit: "City",
    car: "Camry",
    color: "White",
  }),
  S({ id: "P-02", bay: "permit", zone: "permit", col: 1 }),
  S({
    id: "P-03",
    bay: "permit",
    zone: "permit",
    col: 2,
    plate: "50-C-044",
    unit: "City",
    car: "Rav4",
    color: "Silver",
  }),
  S({ id: "P-04", bay: "permit", zone: "permit", col: 3 }),
  S({
    id: "P-05",
    bay: "permit",
    zone: "permit",
    col: 4,
    plate: "50-C-091",
    unit: "City",
    car: "Civic",
    color: "Blue",
  }),
  S({ id: "P-06", bay: "permit", zone: "permit", col: 5 }),
];

export function stallDeck(id: string | undefined) {
  if (!id || id === "curb") return undefined;
  return STALLS.find((s) => s.id === id);
}

export const INITIAL_TICKETS: Ticket[] = [
  {
    id: 101,
    type: "scheduled",
    unit: "702",
    name: "Priya Nair",
    car: "Tesla Y",
    color: "White",
    plate: "HST-4412",
    stall: "B-14",
    due: "Thu 7:05",
    status: "open",
    note: "Standing Metro-North run — warm the cabin. Nest: B-13 first.",
    blockedBy: "B-13",
    requestedAt: T0 - 36 * 3600000,
  },
  {
    id: 102,
    type: "now",
    unit: "308",
    name: "Ravi Patel",
    car: "BMW X5",
    color: "Black",
    plate: "KLM-2291",
    stall: "A-01",
    due: "Now",
    status: "claimed",
    valet: "Luis",
    note: "New Rochelle station · 30 min to GCT",
    requestedAt: T0 - 4 * 60000,
    claimedAt: T0 - 2 * 60000,
  },
  {
    id: 103,
    type: "arrival",
    unit: "702",
    name: "Priya’s sister",
    car: "CR-V",
    color: "Silver",
    plate: "G-441",
    stall: "curb",
    toStall: "R-02",
    due: "4:30 pm",
    status: "open",
    note: "Guest after Toast Coffee · ~3 hours",
    requestedAt: T0 - 50 * 60000,
  },
];

export const INITIAL_CHAT: ChatMsg[] = [
  {
    id: 1,
    from: "Luis",
    kind: "chat",
    at: T0 - 18 * 60000,
    body: "Clocked. Cabinet 07 counted 41 keys.",
  },
  {
    id: 2,
    from: "Derrick",
    kind: "chat",
    at: T0 - 12 * 60000,
    body: "B-13 is nosed in on 702 again. Don’t pull the Tesla until that Audi moves.",
  },
  {
    id: 3,
    from: "Luis",
    kind: "chat",
    at: T0 - 8 * 60000,
    body: "Got 308’s X5. Station run. Back in five.",
  },
  {
    id: 4,
    from: "Runway",
    kind: "system",
    at: T0 - 2 * 60000,
    body: "Luis claimed 308 · KLM-2291 · A-01.",
  },
];

export const FORECAST = [
  { hour: "2p", pulls: 2, actual: 2 },
  { hour: "3p", pulls: 3, actual: 3 },
  { hour: "4p", pulls: 5, actual: 4 },
  { hour: "5p", pulls: 7, actual: 6 },
  { hour: "6p", pulls: 9, actual: 8 },
  { hour: "7p", pulls: 6, actual: 0 },
  { hour: "8p", pulls: 3, actual: 0 },
  { hour: "9p", pulls: 2, actual: 0 },
  { hour: "6a", pulls: 4, actual: 0 },
  { hour: "7a", pulls: 11, actual: 0 },
  { hour: "8a", pulls: 8, actual: 0 },
  { hour: "9a", pulls: 3, actual: 0 },
];

export const RESTACK: RestackMove[] = [
  {
    id: "r1",
    unit: "702",
    plate: "HST-4412",
    car: "Tesla Y",
    from: "B-14",
    to: "A-02 hot / EV",
    why: "Tue/Thu 7:05 GCT, 86% of last 14 days. Sitting behind a nested car tonight.",
  },
];

export const FINGERPRINTS = [
  {
    unit: "702 Nair",
    car: "Tesla Y",
    leave: "Tue/Thu 7:05",
    back: "6:40 pm",
    hit: 86,
    note: "Offer a standing Thursday pickup",
  },
  {
    unit: "308 Patel",
    car: "BMW X5",
    leave: "Weekdays 7:20",
    back: "7:10 pm",
    hit: 91,
    note: "Pre-stage every weekday at 7:05",
  },
  {
    unit: "414 Rossi",
    car: "Audi Q5",
    leave: "Weekdays 8:05",
    back: "5:50 pm",
    hit: 78,
    note: "Often blocks 702 — park beside, not in front",
  },
  {
    unit: "210 Alvarez",
    car: "Pilot",
    leave: "Sat 10:15",
    back: "Sun 4:00",
    hit: 70,
    note: "Deep nest is fine Mon–Fri",
  },
  {
    unit: "1008 Okonkwo",
    car: "Ioniq 5",
    leave: "When EV hits 80%",
    back: "—",
    hit: 0,
    note: "Don’t pull until charge task ends",
  },
];

export function residentOf(unit: string) {
  const c = CONTACTS.find((x) => x.unit === unit) ?? CONTACTS[0];
  const stall = STALLS.find((s) => s.unit === c.unit && s.plate);
  const digits = c.unit.replace(/\D/g, "");
  const floor =
    c.unit.startsWith("PH") ? "PH" : digits.length >= 3 ? digits.slice(0, -2) : digits || "—";
  return {
    unit: c.unit,
    name: c.name,
    first: c.name.split(" ")[0] ?? c.name,
    floor,
    car: stall?.car ?? "Vehicle",
    color: stall?.color ?? "",
    plate: stall?.plate ?? "",
    stall: stall?.id ?? "—",
    charge: stall?.ev ? 74 : undefined,
    keys: "Cabinet 07",
    standing: c.unit === "702" ? "Thu 7:05" : undefined,
    email: c.email,
    phone: c.phone,
    blockedBy: stall?.blockedBy,
  };
}

export const RESIDENT_CHOICES = CONTACTS.filter((c) =>
  STALLS.some((s) => s.unit === c.unit && s.plate),
);
