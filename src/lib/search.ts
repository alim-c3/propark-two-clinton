import type { Stall, Ticket } from "./types";

export function fold(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const MAKE_KEYS: [string, string[]][] = [
  ["tesla", ["tesla"]],
  ["bmw", ["bmw"]],
  ["audi", ["audi"]],
  ["honda", ["honda", "crv", "pilot", "odyssey"]],
  ["toyota", ["camry", "rav4"]],
  ["hyundai", ["ioniq"]],
  ["porsche", ["macan"]],
  ["subaru", ["forester"]],
  ["lexus", ["lexus"]],
  ["ford", ["ford"]],
];

export type CarHit = {
  id: string;
  stallId: string | null;
  plate: string;
  car: string;
  unit?: string;
  where: string;
};

function blobOf(parts: Array<string | null | undefined>) {
  return fold(parts.filter(Boolean).join(" "));
}

function matches(needle: string, blob: string) {
  if (blob.includes(needle)) return true;
  return MAKE_KEYS.some(
    ([make, keys]) =>
      (make.startsWith(needle) || needle.startsWith(make)) &&
      keys.some((k) => blob.includes(k)),
  );
}

export function searchDeck(q: string, stalls: Stall[], tickets: Ticket[]): CarHit[] {
  const needle = fold(q.trim());
  if (needle.length < 2) return [];

  const hits: CarHit[] = [];
  const seen = new Set<string>();

  for (const s of stalls) {
    const blob = blobOf([
      s.id,
      s.plate,
      s.car,
      s.color,
      s.unit,
      s.liftDeck,
      s.liftDeck === "upper" ? "stacker top" : s.liftDeck === "lower" ? "stacker bottom" : "",
    ]);
    if (!matches(needle, blob)) continue;
    seen.add(s.plate ?? s.id);
    hits.push({
      id: s.id,
      stallId: s.id,
      plate: s.plate ?? "—",
      car: s.car ?? (s.plate ? "Unknown" : "Empty"),
      unit: s.unit,
      where: s.liftDeck === "upper" ? `${s.id} ↑` : s.liftDeck === "lower" ? `${s.id} ↓` : s.id,
    });
  }

  for (const t of tickets) {
    if (t.status === "cancelled" || t.status === "released") continue;
    const blob = blobOf([t.stall, t.plate, t.car, t.color, t.unit, t.name]);
    if (!matches(needle, blob)) continue;
    if (t.status === "staged") {
      if (seen.has(t.plate)) continue;
      seen.add(t.plate);
      hits.push({
        id: `curb-${t.id}`,
        stallId: null,
        plate: t.plate,
        car: t.car,
        unit: t.unit,
        where: "Clinton Place curb",
      });
      continue;
    }
    if (t.status === "claimed" && !seen.has(t.plate)) {
      seen.add(t.plate);
      hits.push({
        id: `pull-${t.id}`,
        stallId: t.stall === "curb" ? null : t.stall,
        plate: t.plate,
        car: t.car,
        unit: t.unit,
        where: t.stall === "curb" ? "Clinton Place curb" : `Pulling · ${t.stall}`,
      });
    }
  }

  return hits;
}
