import { grounded, waitBump } from "./cred";
import type { Ticket } from "./types";

export type QueueItem = {
  ticket: Ticket;
  place: number;
  etaMin: number;
  stillMin: number;
};

export function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function placeLine(place: number) {
  if (place <= 1) return "You’re next in line";
  return `You’re ${ordinal(place)} in line`;
}

export function stillLine(mins: number) {
  if (mins <= 1) return "about a minute";
  return `${mins} min`;
}

export function retrieveQueue(
  tickets: Ticket[],
  scores: Record<string, number> = {},
): Ticket[] {
  return tickets
    .filter(
      (t) =>
        t.type === "now" &&
        (t.status === "open" || t.status === "claimed"),
    )
    .sort((a, b) => {
      if (a.status === "claimed" && b.status !== "claimed") return -1;
      if (b.status === "claimed" && a.status !== "claimed") return 1;
      const ga = grounded(scores[a.unit] ?? 70);
      const gb = grounded(scores[b.unit] ?? 70);
      if (ga !== gb) return ga ? 1 : -1;
      return a.requestedAt - b.requestedAt;
    });
}

export function readyNow(tickets: Ticket[]): Ticket[] {
  return tickets.filter((t) => t.type === "now" && t.status === "staged");
}

export function etaMin(
  place: number,
  ticket: { blockedBy?: string; status?: string; unit?: string },
  onFloor: number,
  score = 70,
) {
  const valets = Math.max(1, onFloor);
  let mins = Math.ceil(place / valets) * 5;
  if (ticket.blockedBy) mins += 4;
  if (ticket.status === "claimed") mins = Math.max(2, mins - 2);
  if (ticket.status !== "claimed") mins += waitBump(score);
  return mins;
}

export function stillMin(
  place: number,
  ticket: {
    blockedBy?: string;
    status?: string;
    requestedAt?: number;
    unit?: string;
  },
  onFloor: number,
  now = Date.now(),
  score = 70,
) {
  const quoted = etaMin(place, ticket, onFloor, score);
  if (!now || !ticket.requestedAt) return quoted;
  const elapsed = Math.max(0, Math.floor((now - ticket.requestedAt) / 60000));
  const ahead = Math.max(0, place - (ticket.status === "claimed" ? 1 : 0));
  const floorMins = Math.max(1, ahead * 2 + (ticket.blockedBy ? 2 : 0));
  return Math.max(floorMins, quoted - elapsed);
}

export function withPlaces(
  tickets: Ticket[],
  onFloor: number,
  now = Date.now(),
  scores: Record<string, number> = {},
): QueueItem[] {
  return retrieveQueue(tickets, scores).map((ticket, i) => {
    const place = i + 1;
    const score = scores[ticket.unit] ?? 70;
    return {
      ticket,
      place,
      etaMin: etaMin(place, ticket, onFloor, score),
      stillMin: stillMin(place, ticket, onFloor, now, score),
    };
  });
}

export function placeOf(
  tickets: Ticket[],
  id: number,
  onFloor: number,
  now = Date.now(),
  scores: Record<string, number> = {},
): QueueItem | undefined {
  return withPlaces(tickets, onFloor, now, scores).find((q) => q.ticket.id === id);
}

export function joinPreview(
  tickets: Ticket[],
  onFloor: number,
  nested: boolean,
  now = Date.now(),
  score = 70,
) {
  const place = retrieveQueue(tickets).length + 1;
  const ticket = {
    blockedBy: nested ? "x" : undefined,
    requestedAt: now,
  };
  return {
    place,
    etaMin: etaMin(place, ticket, onFloor, score),
    stillMin: stillMin(place, ticket, onFloor, now, score),
  };
}
