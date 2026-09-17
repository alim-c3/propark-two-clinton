import { stallDeck, STALLS } from "./seed";
import type { Ticket } from "./types";

export type RunDir = "in" | "out" | "restack";
export type LiftDir = "up" | "down" | "none";

export type RunPlan = {
  dir: RunDir;
  from: string;
  to: string;
  lift: LiftDir;
  liftLabel: string;
  destLabel: string;
};

export function stallCode(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/[A-ZP]-\d{2}/i);
  return m ? m[0].toUpperCase() : null;
}

export function runPlan(t: Ticket): RunPlan {
  if (t.type === "arrival") {
    const to = t.toStall ?? stallCode(t.stall) ?? "guest row";
    return {
      dir: "in",
      from: "Clinton Place curb",
      to,
      lift: "down",
      liftLabel: "Lift DOWN to P2",
      destLabel: `Park in ${to}`,
    };
  }
  if (t.type === "restack") {
    const to = t.toStall ?? stallCode(t.note) ?? t.stall;
    const same = to === t.stall;
    return {
      dir: "restack",
      from: t.stall,
      to,
      lift: "none",
      liftLabel: "Stay on P2",
      destLabel: same ? `Keep ${t.stall}` : `${t.stall} → ${to}`,
    };
  }
  const fromStall = stallDeck(t.stall);
  const stacker =
    fromStall?.liftDeck === "upper"
      ? "Drop stacker, then Lift UP to street"
      : fromStall?.liftDeck === "lower"
        ? "Lower is clear. Lift UP to street"
        : "Lift UP to street";
  return {
    dir: "out",
    from: t.stall === "curb" ? "Clinton Place curb" : t.stall,
    to: "Clinton Place curb",
    lift: "up",
    liftLabel: stacker,
    destLabel: "Clinton Place curb",
  };
}

export function pickInboundStall(tickets: Ticket[]): string {
  const reserved = new Set(
    tickets
      .filter(
        (t) =>
          t.toStall && t.status !== "cancelled" && t.status !== "released",
      )
      .map((t) => t.toStall as string),
  );
  const pulled = new Set(
    tickets
      .filter(
        (t) =>
          (t.type === "now" || t.type === "scheduled") &&
          (t.status === "staged" || t.status === "released"),
      )
      .map((t) => t.stall),
  );
  const occ = new Set(
    STALLS.filter((s) => s.plate && !pulled.has(s.id)).map((s) => s.id),
  );
  const taken = new Set([...occ, ...reserved]);
  const prefer = STALLS.filter((s) => s.bay === "guest" || s.bay === "hot");
  return (
    prefer.find((s) => !taken.has(s.id))?.id ??
    STALLS.find((s) => !taken.has(s.id))?.id ??
    "R-01"
  );
}

export function stallTaken(
  tickets: Ticket[],
  stallId: string,
  ignoreId?: number,
) {
  const others = tickets.filter((t) => t.id !== ignoreId);
  if (
    others.some(
      (t) =>
        t.toStall === stallId &&
        t.status !== "cancelled" &&
        t.status !== "released",
    )
  )
    return true;
  const pulled = others.some(
    (t) =>
      t.stall === stallId &&
      t.type !== "arrival" &&
      (t.status === "staged" || t.status === "released"),
  );
  const arrivingOpen = tickets.some(
    (t) =>
      t.type === "arrival" &&
      t.toStall === stallId &&
      t.status !== "staged" &&
      t.status !== "released" &&
      t.status !== "cancelled",
  );
  const seed = STALLS.find((s) => s.id === stallId);
  return Boolean(seed?.plate) && !pulled && !arrivingOpen;
}
