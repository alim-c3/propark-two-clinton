import { create } from "zustand";
import { INITIAL_PUNCHES, INITIAL_PULLS } from "./attendants";
import { credEvent, INITIAL_CRED, scoreOf, type CredEvent, type CredKind } from "./cred";
import { pickInboundStall, runPlan, stallCode, stallTaken } from "./run";
import { CONTACTS, INITIAL_CHAT, INITIAL_RIDE_PINGS, INITIAL_TICKETS, RESTACK, residentOf, STALLS, keyRequestCopy, ridePingCopy } from "./seed";
import { etaMin, placeLine, retrieveQueue, stillLine } from "./queue";
import type { ChatMsg, KeyPing, Punch, Result, RidePing, ShiftPull, Ticket, TicketStatus, TicketType } from "./types";

type StaffKey = "you" | "Luis" | "Ana" | "Derrick";
type RestackState = "pending" | "accepted" | "dismissed";

type LaneState = {
  tickets: Ticket[];
  nextId: number;
  staff: Record<StaffKey, boolean>;
  restack: Record<string, RestackState>;
  chat: ChatMsg[];
  chatId: number;
  keyPings: KeyPing[];
  pingId: number;
  ridePings: RidePing[];
  rideId: number;
  punches: Punch[];
  pulls: ShiftPull[];
  onBreak: boolean;
  cred: CredEvent[];
  activeUnit: string;
  setActiveUnit: (unit: string) => void;
  requestNow: (note?: string) => Result;
  schedule: (kind: TicketType, due: string, note: string) => Result;
  cancel: (id: number) => Result;
  clock: (on: boolean) => Result;
  setBreak: (on: boolean) => Result;
  unnest: (id: number) => Result;
  lift: (id: number) => Result;
  advance: (id: number) => Result;
  takeCar: (stallId: string) => Result;
  acceptRestack: (id: string) => Result;
  dismissRestack: (id: string) => Result;
  postChat: (body: string) => Result;
  pingKeys: (unit: string) => Result;
  ackKeys: (id: number) => Result;
  reset: () => void;
};

function pushRide(
  pings: RidePing[],
  rideId: number,
  t: Ticket,
  kind: RidePing["kind"],
) {
  const ping: RidePing = {
    id: rideId + 1,
    unit: t.unit,
    ticketId: t.id,
    kind,
    sms: ridePingCopy(t, kind),
    at: Date.now(),
  };
  return { rideId: ping.id, ridePings: [ping, ...pings] };
}

function nextStatus(s: TicketStatus): TicketStatus | null {
  if (s === "open") return "claimed";
  if (s === "claimed") return "staged";
  if (s === "staged") return "released";
  return null;
}

function pushChat(
  chat: ChatMsg[],
  chatId: number,
  from: string,
  body: string,
  kind: ChatMsg["kind"] = "system",
) {
  return {
    chatId: chatId + 1,
    chat: [...chat, { id: chatId + 1, from, body, at: Date.now(), kind }],
  };
}

function fresh(): Pick<
  LaneState,
  | "tickets"
  | "nextId"
  | "staff"
  | "restack"
  | "chat"
  | "chatId"
  | "keyPings"
  | "pingId"
  | "ridePings"
  | "rideId"
  | "punches"
  | "pulls"
  | "onBreak"
  | "cred"
> {
  return {
    tickets: INITIAL_TICKETS.map((t) => ({ ...t })),
    nextId: 200,
    staff: { you: false, Luis: true, Ana: false, Derrick: true },
    restack: Object.fromEntries(RESTACK.map((r) => [r.id, "pending" as RestackState])),
    chat: INITIAL_CHAT.map((m) => ({ ...m })),
    chatId: 10,
    keyPings: [],
    pingId: 1,
    ridePings: INITIAL_RIDE_PINGS.map((p) => ({ ...p })),
    rideId: 1,
    punches: INITIAL_PUNCHES.map((p) => ({ ...p })),
    pulls: INITIAL_PULLS.map((p) => ({ ...p })),
    onBreak: false,
    cred: INITIAL_CRED.map((e) => ({ ...e })),
  };
}

export const useLane = create<LaneState>((set, get) => ({
  ...fresh(),
  activeUnit: "702",
  setActiveUnit: (unit) => set({ activeUnit: unit }),

  requestNow: (note) => {
    const me = residentOf(get().activeUnit);
    const busy = get().tickets.find(
      (t) =>
        t.unit === me.unit &&
        t.type === "now" &&
        (t.status === "open" || t.status === "claimed" || t.status === "staged"),
    );
    if (busy) {
      return { ok: false, message: "We already have a retrieve downstairs." };
    }
    const id = get().nextId;
    const s = get();
    const nestStill = Boolean(me.blockedBy) &&
      Boolean(STALLS.find((st) => st.id === me.blockedBy)?.plate) &&
      !s.tickets.some((t) => t.stall === me.blockedBy && t.unnestedAt);
    const posted = pushChat(
      s.chat,
      s.chatId,
      "Runway",
      nestStill
        ? `${me.unit} tapped Get going. ${me.car} ${me.plate} on ${me.stall} — nested behind ${me.blockedBy}.`
        : `${me.unit} tapped Get going. ${me.car} ${me.plate} on ${me.stall}.`,
    );
    const ticket = {
      id,
      type: "now" as const,
      unit: me.unit,
      name: me.name,
      car: me.car,
      color: me.color,
      plate: me.plate,
      stall: me.stall,
      due: "Now",
      status: "open" as const,
      note: note || (nestStill ? `Get going. Nest: move ${me.blockedBy} first.` : "Get going."),
      blockedBy: nestStill ? me.blockedBy : undefined,
      requestedAt: Date.now(),
    };
    set({
      nextId: id + 1,
      ...posted,
      tickets: [ticket, ...s.tickets],
    });
    const floor = Object.values(s.staff).filter(Boolean).length;
    const scores = { [me.unit]: scoreOf(s.cred, me.unit) };
    const place =
      retrieveQueue([ticket, ...s.tickets], scores).findIndex((t) => t.id === id) + 1;
    const cred = scoreOf(s.cred, me.unit);
    const mins = etaMin(place, ticket, floor, cred);
    return {
      ok: true,
      message: `${placeLine(place)}. ${stillLine(mins)}.`,
    };
  },

  schedule: (kind, due, note) => {
    const me = residentOf(get().activeUnit);
    const arrival = kind === "arrival";
    const standing = due.includes("7:05");
    if (
      standing &&
      get().tickets.some(
        (t) =>
          t.unit === me.unit &&
          t.type === "scheduled" &&
          t.status === "open" &&
          t.due.includes("7:05"),
      )
    ) {
      return { ok: false, message: "Thursday 7:05 is already on the board." };
    }
    const id = get().nextId;
    const s = get();
    const posted = pushChat(
      s.chat,
      s.chatId,
      "Runway",
      arrival
        ? `${me.unit} inbound. Hold a guest stall.`
        : `${me.unit} scheduled pickup ${due || "tomorrow 7:05"}.`,
    );
    set({
      nextId: id + 1,
      ...posted,
      tickets: [
        {
          id,
          type: arrival ? "arrival" : "scheduled",
          unit: me.unit,
          name: arrival ? `${me.first} heading home` : me.name,
          car: me.car,
          color: me.color,
          plate: me.plate,
          stall: arrival ? "curb" : me.stall,
          due: due || "Tomorrow 7:05",
          status: "open",
          note:
            note ||
            (arrival ? "Hold a curb stall on Clinton Place" : "Scheduled pickup"),
          blockedBy: arrival ? undefined : me.blockedBy,
          requestedAt: Date.now(),
        },
        ...s.tickets,
      ],
    });
    return {
      ok: true,
      message: arrival
        ? "We’ll keep a space warm for you."
        : "Saved. We’ll start it a few minutes early.",
    };
  },

  cancel: (id) => {
    const t = get().tickets.find((x) => x.id === id);
    if (!t || t.status !== "open") {
      return {
        ok: false,
        message: "Too late to cancel — it’s already in motion. The desk can still help.",
      };
    }
    const kind: CredKind = t.type === "now" ? "now_cancel" : "cancel_early";
    const s = get();
    set({
      tickets: s.tickets.map((x) =>
        x.id === id ? { ...x, status: "cancelled" } : x,
      ),
      cred: [credEvent(t.unit, kind), ...s.cred],
      ...pushChat(s.chat, s.chatId, "Runway", `702 cancelled ${t.plate}.`),
    });
    return {
      ok: true,
      message:
        kind === "now_cancel"
          ? "Cancelled. Street cred took a hit — next time cancel only if you mean it."
          : "Cancelled. Thanks for the heads-up — Street cred noticed.",
    };
  },

  clock: (on) => {
    if (!on) {
      const held = get().tickets.find(
        (t) =>
          t.valet === "You" &&
          (t.status === "claimed" || t.status === "staged"),
      );
      if (held?.status === "staged") {
        return {
          ok: false,
          message: "Hand off the car at the curb before you bounce.",
        };
      }
      if (held) {
        return { ok: false, message: "Hand off that claimed car before you bounce." };
      }
    }
    const s = get();
    const now = Date.now();
    const punches = [...s.punches];
    if (!on && s.onBreak) {
      punches.push({ who: "You", kind: "break-end", at: now });
    }
    punches.push({ who: "You", kind: on ? "in" : "out", at: now });
    set({
      staff: { ...s.staff, you: on },
      onBreak: false,
      punches,
      ...pushChat(
        s.chat,
        s.chatId,
        "Runway",
        on ? "You checked in. Cabinet 07 unlocked." : "You checked out. Keys counted.",
      ),
    });
    return {
      ok: true,
      message: on
        ? "Welcome in. Cabinet 07 just unlocked."
        : "Checked out. Keys counted.",
    };
  },

  setBreak: (on) => {
    if (!get().staff.you) {
      return { ok: false, message: "Check in first." };
    }
    if (on === get().onBreak) {
      return { ok: false, message: on ? "Already on break." : "You’re already back." };
    }
    if (on) {
      const held = get().tickets.find(
        (t) =>
          t.valet === "You" &&
          (t.status === "claimed" || t.status === "staged"),
      );
      if (held) {
        return { ok: false, message: `Finish ${held.plate} before you take a break.` };
      }
    }
    const s = get();
    const now = Date.now();
    set({
      onBreak: on,
      punches: [
        ...s.punches,
        { who: "You", kind: on ? "break-start" : "break-end", at: now },
      ],
      ...pushChat(
        s.chat,
        s.chatId,
        "Runway",
        on ? "You stepped off for a break." : "You’re back on the runway.",
      ),
    });
    return {
      ok: true,
      message: on ? "Break started. We’ll hold the queue." : "Welcome back.",
    };
  },

  unnest: (id) => {
    if (!get().staff.you) {
      return { ok: false, message: "Check in first." };
    }
    if (get().onBreak) {
      return { ok: false, message: "You’re on break. Come back first." };
    }
    const t = get().tickets.find((x) => x.id === id);
    if (!t) return { ok: false, message: "Ticket gone." };
    if (t.status !== "claimed") {
      return { ok: false, message: "Claim it before you move the blocker." };
    }
    if (!t.blockedBy) {
      return { ok: false, message: "Nest is already clear." };
    }
    const s = get();
    set({
      tickets: s.tickets.map((x) =>
        x.id === id ? { ...x, blockedBy: undefined, unnestedAt: Date.now() } : x,
      ),
      ...pushChat(s.chat, s.chatId, "Runway", `You cleared ${t.blockedBy}. Pull ${t.plate}.`),
    });
    return { ok: true, message: `Nest is clear. Pull ${t.plate}.` };
  },

  lift: (id) => {
    if (!get().staff.you) {
      return { ok: false, message: "Check in first." };
    }
    if (get().onBreak) {
      return { ok: false, message: "You’re on break. Come back first." };
    }
    const t = get().tickets.find((x) => x.id === id);
    if (!t) return { ok: false, message: "Ticket gone." };
    if (t.valet !== "You" || t.status !== "claimed") {
      return { ok: false, message: "Claim it before you take the lift." };
    }
    if (t.blockedBy) {
      return { ok: false, message: `Move ${t.blockedBy} first.` };
    }
    if (t.liftedAt) {
      return { ok: false, message: "Already in the lift." };
    }
    const plan = runPlan(t);
    if (plan.lift === "none") {
      return { ok: false, message: "This one stays on P2." };
    }
    const s = get();
    set({
      tickets: s.tickets.map((x) =>
        x.id === id ? { ...x, liftedAt: Date.now() } : x,
      ),
      ...pushChat(
        s.chat,
        s.chatId,
        "Runway",
        `${t.plate} in the car lift · ${plan.liftLabel} · to ${plan.to}.`,
      ),
    });
    return {
      ok: true,
      message:
        plan.lift === "up"
          ? `Lift UP. ${t.plate} to Clinton Place.`
          : `Lift DOWN. Park in ${plan.to}.`,
    };
  },

  takeCar: (stallId) => {
    if (!get().staff.you) {
      return { ok: false, message: "Check in first." };
    }
    if (get().onBreak) {
      return { ok: false, message: "You’re on break. Come back first." };
    }
    const s = get();
    const holding = s.tickets.find(
      (t) =>
        t.valet === "You" &&
        (t.status === "claimed" || t.status === "staged"),
    );
    if (
      holding &&
      holding.type === "arrival" &&
      holding.status === "claimed"
    ) {
      if (stallTaken(s.tickets, stallId, holding.id)) {
        return { ok: false, message: `${stallId} is taken. Pick an open stall.` };
      }
      set({
        tickets: s.tickets.map((x) =>
          x.id === holding.id ? { ...x, toStall: stallId } : x,
        ),
        ...pushChat(
          s.chat,
          s.chatId,
          "Runway",
          `Park ${holding.plate} in ${stallId}.`,
        ),
      });
      return {
        ok: true,
        message: `Park in ${stallId}. Tap Task completed when it’s in.`,
      };
    }
    const job = s.tickets.find(
      (t) =>
        t.status !== "cancelled" &&
        t.status !== "released" &&
        (t.stall === stallId || t.toStall === stallId),
    );
    if (!job) return { ok: true, message: "" };
    if (job.status === "open") return get().advance(job.id);
    if (job.valet === "You") {
      return { ok: true, message: `${job.plate} is already yours.` };
    }
    return { ok: false, message: `${job.valet ?? "Someone"} already has ${job.plate}.` };
  },

  advance: (id) => {
    if (!get().staff.you) {
      return { ok: false, message: "Check in first." };
    }
    if (get().onBreak) {
      return { ok: false, message: "You’re on break. Come back first." };
    }
    const t = get().tickets.find((x) => x.id === id);
    if (!t) return { ok: false, message: "Ticket gone." };
    if (t.status === "claimed" && t.blockedBy) {
      return { ok: false, message: `Move ${t.blockedBy} first.` };
    }
    const nxt = nextStatus(t.status);
    if (!nxt) return { ok: false, message: "Nothing left to do." };
    if (nxt === "staged") {
      const plan = runPlan(t);
      if (plan.lift !== "none" && !t.liftedAt) {
        return { ok: false, message: `Take the lift first. ${plan.liftLabel}.` };
      }
    }
    if (nxt === "claimed") {
      const holding = get().tickets.find(
        (x) =>
          x.id !== id &&
          x.valet === "You" &&
          (x.status === "claimed" || x.status === "staged"),
      );
      if (holding) {
        return {
          ok: false,
          message: `One car at a time. Finish ${holding.plate} first.`,
        };
      }
    }
    const now = Date.now();
    const s = get();
    const plan = runPlan({
      ...t,
      toStall:
        t.toStall ??
        (t.type === "arrival" ? pickInboundStall(s.tickets) : t.toStall),
    });
    const toStall =
      nxt === "claimed" && t.type === "arrival"
        ? t.toStall ?? pickInboundStall(s.tickets)
        : t.toStall;
    const line =
      nxt === "claimed"
        ? `You claimed ${t.plate} · ${plan.from} → ${plan.to} · ${plan.liftLabel}.`
        : nxt === "staged"
          ? plan.dir === "in"
            ? `${t.plate} parked in ${plan.to}.`
            : `${t.plate} staged at Clinton Place curb.`
          : `Handed off ${t.plate} to APT ${t.unit}.`;
    const pulls =
      nxt === "released"
        ? [
            {
              who: "You" as const,
              plate: t.plate,
              car: t.car,
              unit: t.unit,
              stall: t.stall,
              at: now,
              mins: t.claimedAt
                ? Math.max(1, Math.round((now - t.claimedAt) / 60000))
                : 5,
              nest: Boolean(t.unnestedAt),
            },
            ...s.pulls,
          ]
        : s.pulls;
    const cred =
      nxt === "released"
        ? [
            credEvent(
              t.unit,
              t.type === "scheduled" ? "standing_kept" : "on_time",
            ),
            ...s.cred,
          ]
        : s.cred;
    const ride =
      nxt === "claimed"
        ? pushRide(s.ridePings, s.rideId, { ...t, valet: "You" }, "getting")
        : nxt === "staged"
          ? pushRide(s.ridePings, s.rideId, { ...t, toStall: toStall ?? t.toStall }, "ready")
          : { ridePings: s.ridePings, rideId: s.rideId };
    set({
      tickets: s.tickets.map((x) =>
        x.id === id
          ? {
              ...x,
              status: nxt,
              valet: nxt === "claimed" ? "You" : x.valet,
              toStall: toStall ?? x.toStall,
              stall:
                nxt === "staged" && plan.dir === "in" && toStall
                  ? toStall
                  : x.stall,
              claimedAt: nxt === "claimed" ? now : x.claimedAt,
              stagedAt: nxt === "staged" ? now : x.stagedAt,
              releasedAt: nxt === "released" ? now : x.releasedAt,
            }
          : x,
      ),
      pulls,
      cred,
      ...ride,
      ...pushChat(s.chat, s.chatId, "Runway", line),
    });
    const msg =
      nxt === "claimed"
        ? `${plan.liftLabel}. ${plan.destLabel}. Resident pinged: we’re getting the car.`
        : nxt === "staged"
          ? plan.dir === "in"
            ? `${t.plate} is in ${plan.to}. Resident pinged.`
            : `Ready on the runway. Resident pinged.`
          : `Handed off ${t.plate}.`;
    return { ok: true, message: msg };
  },

  acceptRestack: (id) => {
    const item = RESTACK.find((r) => r.id === id);
    if (!item) return { ok: false, message: "Move gone." };
    if (get().restack[id] === "accepted") {
      return { ok: false, message: "Already queued for tonight." };
    }
    const tid = get().nextId;
    const s = get();
    set({
      nextId: tid + 1,
      restack: { ...s.restack, [id]: "accepted" },
      tickets: [
        {
          id: tid,
          type: "restack",
          unit: item.unit,
          name: "Night restack",
          car: item.car,
          color:
            s.tickets.find((t) => t.plate === item.plate)?.color ?? "—",
          plate: item.plate,
          stall: item.from,
          toStall: stallCode(item.to) ?? item.from,
          due: "Tonight 11:00",
          status: "open",
          note: `Move ${item.from} → ${item.to}. ${item.why}`,
          requestedAt: Date.now(),
        },
        ...s.tickets,
      ],
      ...pushChat(s.chat, s.chatId, "Runway", `Restack queued: ${item.plate} ${item.from} → ${item.to}.`),
    });
    return { ok: true, message: "Queued. Valets will see it on the board." };
  },

  dismissRestack: (id) => {
    set({ restack: { ...get().restack, [id]: "dismissed" } });
    return { ok: true, message: "Left where it sits." };
  },

  postChat: (body) => {
    const text = body.trim();
    if (!text) return { ok: false, message: "Type something." };
    const s = get();
    set(pushChat(s.chat, s.chatId, "You", text, "chat"));
    return { ok: true, message: "Sent to the floor." };
  },

  pingKeys: (unit) => {
    const open = get().keyPings.find((p) => p.unit === unit && p.status === "sent");
    if (open) {
      return { ok: false, message: `Already pinged ${unit}. Waiting on them.` };
    }
    const c = CONTACTS.find((x) => x.unit === unit);
    if (!c) return { ok: false, message: "No contact on file for that unit." };
    const s = get();
    const car =
      s.tickets.find((t) => t.unit === unit && t.status !== "cancelled") ??
      STALLS.find((st) => st.unit === unit || st.unit === `Guest ${unit}`);
    const copy = keyRequestCopy(
      c,
      car ? { car: car.car ?? c.name, plate: car.plate ?? "" } : undefined,
    );
    const ping: KeyPing = {
      id: s.pingId + 1,
      unit: c.unit,
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: "sent",
      at: Date.now(),
      by: "You",
      sms: copy.sms,
      emailSubject: copy.emailSubject,
      emailBody: copy.emailBody,
    };
    set({
      pingId: ping.id,
      keyPings: [ping, ...s.keyPings],
      ...pushChat(
        s.chat,
        s.chatId,
        "Runway",
        `Key ping → APT ${c.unit}. SMS ${c.phone} + email ${c.email}. Don’t walk upstairs.`,
      ),
    });
    return {
      ok: true,
      message: `Texted ${c.phone} and emailed ${c.email}.`,
    };
  },

  ackKeys: (id) => {
    const p = get().keyPings.find((x) => x.id === id);
    if (!p || p.status !== "sent") {
      return { ok: false, message: "Nothing to confirm." };
    }
    const s = get();
    set({
      keyPings: s.keyPings.map((x) =>
        x.id === id ? { ...x, status: "acked" } : x,
      ),
      cred: [credEvent(p.unit, "keys_fast"), ...s.cred],
      ...pushChat(s.chat, s.chatId, "Runway", `APT ${p.unit} confirmed keys are coming down.`),
    });
    return { ok: true, message: "Told the garage. Nobody’s coming upstairs." };
  },

  reset: () => set({ ...fresh(), activeUnit: get().activeUnit }),
}));
