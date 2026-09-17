export type CredKind =
  | "on_time"
  | "standing_kept"
  | "scheduled_ok"
  | "cancel_early"
  | "keys_fast"
  | "now_cancel"
  | "no_show"
  | "keys_slow"
  | "ghost";

export type CredEvent = {
  unit: string;
  kind: CredKind;
  pts: number;
  label: string;
  at: number;
};

export const CRED_BASE = 50;

export const CRED_PTS: Record<CredKind, number> = {
  on_time: 3,
  standing_kept: 4,
  scheduled_ok: 2,
  cancel_early: 2,
  keys_fast: 3,
  now_cancel: -10,
  no_show: -18,
  keys_slow: -8,
  ghost: -12,
};

export const CRED_LABEL: Record<CredKind, string> = {
  on_time: "At the curb when we staged it",
  standing_kept: "Standing pickup kept",
  scheduled_ok: "Asked with a time — and took it",
  cancel_early: "Cancelled before a valet rolled",
  keys_fast: "Keys at Cabinet 07",
  now_cancel: "Asked now, then cancelled",
  no_show: "Car sat at the curb — nobody came",
  keys_slow: "Keys stayed upstairs",
  ghost: "Asked now and never came down",
};

export type CredTier = {
  id: "cleared" | "runway" | "holding" | "grounded";
  label: string;
  wait: string;
};

export function tierOf(score: number): CredTier {
  if (score >= 90)
    return {
      id: "cleared",
      label: "Cleared for takeoff",
      wait: "Standing pickups get pre-staged. Ties go your way.",
    };
  if (score >= 75)
    return {
      id: "runway",
      label: "On the runway",
      wait: "Normal line. Keep showing up and you’ll clear.",
    };
  if (score >= 55)
    return {
      id: "holding",
      label: "Holding short",
      wait: "Now-requests wait a little longer. Pick a time when you can.",
    };
  return {
    id: "grounded",
    label: "Grounded",
    wait: "Now-requests go last. Too many false asks.",
  };
}

export function scoreOf(events: CredEvent[], unit: string) {
  const sum = events
    .filter((e) => e.unit === unit)
    .reduce((a, e) => a + e.pts, 0);
  return Math.max(0, Math.min(100, CRED_BASE + sum));
}

export function waitBump(score: number) {
  if (score < 55) return 4;
  if (score < 75) return 2;
  return 0;
}

export function grounded(score: number) {
  return score < 55;
}

export function scoreMap(events: CredEvent[], units: string[]) {
  return Object.fromEntries(units.map((u) => [u, scoreOf(events, u)]));
}

export function credEvent(unit: string, kind: CredKind, at = Date.now()): CredEvent {
  return { unit, kind, pts: CRED_PTS[kind], label: CRED_LABEL[kind], at };
}

const T0 = Date.now();
function days(n: number) {
  return T0 - n * 86400000;
}
function ev(unit: string, kind: CredKind, day: number): CredEvent {
  return credEvent(unit, kind, days(day));
}

export const INITIAL_CRED: CredEvent[] = [
  ev("702", "standing_kept", 1),
  ev("702", "standing_kept", 3),
  ev("702", "standing_kept", 8),
  ev("702", "standing_kept", 10),
  ev("702", "standing_kept", 15),
  ev("702", "on_time", 2),
  ev("702", "on_time", 4),
  ev("702", "on_time", 5),
  ev("702", "on_time", 9),
  ev("702", "on_time", 11),
  ev("702", "keys_fast", 8),

  ev("308", "standing_kept", 1),
  ev("308", "standing_kept", 2),
  ev("308", "standing_kept", 3),
  ev("308", "standing_kept", 4),
  ev("308", "standing_kept", 7),
  ev("308", "standing_kept", 8),
  ev("308", "on_time", 1),
  ev("308", "on_time", 2),
  ev("308", "on_time", 3),
  ev("308", "on_time", 6),
  ev("308", "on_time", 7),
  ev("308", "on_time", 9),
  ev("308", "keys_fast", 2),
  ev("308", "keys_fast", 8),

  ev("414", "standing_kept", 1),
  ev("414", "standing_kept", 2),
  ev("414", "standing_kept", 5),
  ev("414", "standing_kept", 8),
  ev("414", "on_time", 3),
  ev("414", "on_time", 6),
  ev("414", "on_time", 9),
  ev("414", "on_time", 11),
  ev("414", "cancel_early", 4),

  ev("PH4", "on_time", 2),
  ev("PH4", "on_time", 6),
  ev("PH4", "on_time", 12),
  ev("PH4", "now_cancel", 1),
  ev("PH4", "now_cancel", 5),
  ev("PH4", "ghost", 9),

  ev("210", "standing_kept", 3),
  ev("210", "on_time", 3),
  ev("210", "on_time", 10),
  ev("210", "now_cancel", 1),
  ev("210", "now_cancel", 6),
  ev("210", "no_show", 8),

  ev("1512", "standing_kept", 2),
  ev("1512", "standing_kept", 9),
  ev("1512", "standing_kept", 16),
  ev("1512", "on_time", 4),
  ev("1512", "on_time", 7),
  ev("1512", "on_time", 11),
  ev("1512", "on_time", 14),
  ev("1512", "keys_fast", 7),

  ev("1008", "standing_kept", 5),
  ev("1008", "standing_kept", 12),
  ev("1008", "on_time", 5),
  ev("1008", "on_time", 8),
  ev("1008", "on_time", 12),
  ev("1008", "keys_fast", 5),
  ev("1008", "keys_fast", 12),
];
