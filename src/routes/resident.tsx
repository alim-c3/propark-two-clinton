"use client";

import { createFileRoute } from "@tanstack/react-router";
import { Mail, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chrome } from "@/components/chrome";
import { DemoBar, Flip } from "@/components/demo-bar";
import { StreetCredCard } from "@/components/street-cred";
import { TicketCard } from "@/components/ticket-card";
import { Button } from "@/components/ui/button";
import { CurbPager } from "@/components/wait-list";
import { CONTACTS, RESIDENT_CHOICES, residentOf } from "@/lib/seed";
import { scoreMap } from "@/lib/cred";
import { useLane } from "@/lib/store";
import { placeLine, placeOf } from "@/lib/queue";
import type { Ticket, TicketType } from "@/lib/types";
import { localInputValue, cn, useNow } from "@/lib/utils";

export const Route = createFileRoute("/resident")({ component: Resident });

function isLive(t: Ticket) {
  return t.status === "open" || t.status === "claimed" || t.status === "staged";
}

function Resident() {
  const tickets = useLane((s) => s.tickets);
  const staff = useLane((s) => s.staff);
  const requestNow = useLane((s) => s.requestNow);
  const schedule = useLane((s) => s.schedule);
  const cancel = useLane((s) => s.cancel);
  const keyPings = useLane((s) => s.keyPings);
  const ackKeys = useLane((s) => s.ackKeys);
  const cred = useLane((s) => s.cred);
  const ridePings = useLane((s) => s.ridePings);
  const activeUnit = useLane((s) => s.activeUnit);
  const setActiveUnit = useLane((s) => s.setActiveUnit);
  const now = useNow();
  const me = residentOf(activeUnit);

  const mine = tickets.filter(
    (t) => t.unit === me.unit && t.type !== "restack",
  );
  const live =
    mine.find((t) => t.type === "now" && isLive(t)) ??
    mine.find(
      (t) =>
        t.type !== "arrival" &&
        (t.status === "claimed" || t.status === "staged"),
    );
  const standing = mine.find(
    (t) =>
      t.type === "scheduled" &&
      t.status === "open" &&
      t.due.includes("7:05"),
  );
  const keyAsk = keyPings.find(
    (p) => p.unit === me.unit && p.status === "sent",
  );
  const ride = ridePings.find((p) => p.unit === me.unit);

  const [confirm, setConfirm] = useState(false);
  const [more, setMore] = useState(true);
  const [sheet, setSheet] = useState<TicketType | null>(null);
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 45);
    return localInputValue(d);
  });
  const [note, setNote] = useState("");

  const onFloor = Object.values(staff).filter(Boolean).length;
  const scores = scoreMap(
    cred,
    CONTACTS.map((c) => c.unit),
  );
  const spot = live ? placeOf(tickets, live.id, onFloor, now, scores) : undefined;

  const h1 =
    live?.status === "staged"
      ? "Your car is ready on the runway."
      : live?.status === "claimed"
        ? "We’re getting your car."
        : spot
          ? `${placeLine(spot.place)}.`
          : live?.type === "now"
            ? "Your car is on its way."
            : `Hi ${me.first}. We’ll help you take off.`;
  const cap =
    live?.status === "staged"
      ? "The garage already knew you wanted it."
      : live?.status === "claimed"
        ? "A valet has it. We’ll ping you when it’s on the runway."
        : spot
          ? `${spot.stillMin <= 1 ? "About a minute" : `${spot.stillMin} min`} · still in ${live?.stall}.`
          : standing
            ? "Thursday 7:05 is on your list. The garage already knew."
            : `Your ${me.car} is downstairs in ${me.stall}${me.charge ? `, ${me.charge}%` : ""}.`;

  function go() {
    const r = requestNow();
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) {
      setConfirm(false);
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <Chrome />
      <div className="mx-auto max-w-lg px-4 py-6">
        <DemoBar />
        <div className="mt-4 flex flex-wrap gap-1">
          {RESIDENT_CHOICES.map((c) => (
            <button
              key={c.unit}
              type="button"
              onClick={() => setActiveUnit(c.unit)}
              className={cn(
                "rounded-full px-3 py-2 text-xs font-semibold min-h-10",
                c.unit === me.unit ? "bg-gold text-navy" : "bg-white text-muted",
              )}
            >
              Apt {c.unit}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[10px] font-bold tracking-[0.18em] text-gold-2">
          GOOD EVENING · APT {me.unit} · FLOOR {me.floor}
        </p>
        <h1 className="mt-2 font-display text-3xl text-navy">{h1}</h1>
        <p className="mt-2 text-sm text-muted">{cap}</p>

        <CurbPager
          tickets={tickets}
          staff={staff}
          mine={live?.type === "now" ? live : undefined}
          nested
        >
          {!live || live.type === "arrival" ? (
            !confirm ? (
              <Button variant="gold" size="block" onClick={() => setConfirm(true)}>
                Get going
              </Button>
            ) : (
              <div className="rounded-xl border border-gold bg-cream p-4">
                <p className="font-display text-lg text-navy">Ready to take off?</p>
                <p className="mt-1 text-sm text-muted">
                  You’ll get your place in line and a wait — nothing else.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Button variant="gold" size="block" onClick={go}>
                    Yes — let’s take off
                  </Button>
                  <Button variant="ghost" size="block" onClick={() => setConfirm(false)}>
                    Keep it charging
                  </Button>
                </div>
              </div>
            )
          ) : null}
        </CurbPager>

        {live?.type === "now" && live.status === "open" ? (
          <Flip
            to="/valet"
            label={`Open valet — they have your ${me.car}`}
            why="Clock in. Nest is B-13. One job until it’s ready."
          />
        ) : null}
        {live?.status === "claimed" ? (
          <p className="mt-4 rounded-2xl bg-gold/20 px-4 py-3 text-sm text-navy">
            A valet is on it. Stay here — you’ll get a ping when it’s ready.
          </p>
        ) : null}

        {ride ? (
          <section className="mt-4 rounded-2xl border border-gold bg-gold/20 p-4">
            <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
              TEXT · {me.phone}
            </p>
            <p className="mt-1 font-display text-xl text-navy">
              {ride.kind === "ready"
                ? "Your car is ready on the runway."
                : "We’re getting your car."}
            </p>
            <p className="mt-1 text-sm text-navy/80">{ride.sms}</p>
          </section>
        ) : null}

        {keyAsk ? (
          <section className="mt-4 rounded-2xl border border-gold bg-gold/20 p-4">
            <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
              KEYS · TEXT + EMAIL
            </p>
            <p className="mt-1 font-display text-xl text-navy">
              The garage needs your keys.
            </p>
            <p className="mt-1 text-sm text-muted">
              Drop them at Cabinet 07 in the lobby. Nobody is coming upstairs.
            </p>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl bg-white px-3 py-3 text-sm text-navy">
                <p className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-gold-2">
                  <Smartphone className="size-3.5" />
                  TEXT · {me.phone}
                </p>
                <p className="mt-1">{keyAsk.sms}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-3 text-sm text-navy">
                <p className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-gold-2">
                  <Mail className="size-3.5" />
                  EMAIL · {me.email}
                </p>
                <p className="mt-1 font-semibold">{keyAsk.emailSubject}</p>
              </div>
            </div>
            <Button
              className="mt-3"
              variant="navy"
              size="block"
              onClick={() => {
                const r = ackKeys(keyAsk.id);
                toast[r.ok ? "success" : "error"](r.message);
              }}
            >
              They’re in the cabinet
            </Button>
          </section>
        ) : null}

        {live && live.type === "now" && live.status === "open" ? (
          <Button
            className="mt-4"
            variant="danger"
            size="block"
            onClick={() => {
              if (!window.confirm("Cancel this pickup?")) return;
              const r = cancel(live.id);
              toast[r.ok ? "success" : "error"](r.message);
            }}
          >
            Cancel this pickup
          </Button>
        ) : null}

        <p className="mt-4 text-sm text-muted">
          {me.car} · {me.color} · {me.plate}
          {live?.status === "staged" ? " · at Clinton Place curb" : ` · ${me.stall}`}
        </p>

        <button
          type="button"
          className={cn("mt-6 text-sm font-semibold", more ? "text-navy" : "text-gold-2")}
          onClick={() => setMore((v) => !v)}
        >
          {more ? "Hide more" : "More — schedule, cred, other requests"}
        </button>

        {more ? (
          <div className="mt-4 space-y-4">
            <StreetCredCard unit={me.unit} />
            {standing ? (
              <p className="text-sm text-muted">
                Thursday 7:05 is already on your list.
              </p>
            ) : (
              <Button
                variant="navy"
                size="block"
                onClick={() => {
                  const r = schedule(
                    "scheduled",
                    me.standing ?? "Thu 7:05",
                    "Standing Metro-North run — warm the cabin",
                  );
                  toast[r.ok ? "success" : "error"](r.message);
                }}
              >
                Thursday 7:05
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" size="block" onClick={() => setSheet("scheduled")}>
                Pick a time
              </Button>
              <Button variant="ghost" size="block" onClick={() => setSheet("arrival")}>
                I’m on my way in
              </Button>
            </div>
            {sheet ? (
              <form
                className="border-t border-line pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const r = schedule(sheet, when.replace("T", " "), note);
                  toast[r.ok ? "success" : "error"](r.message);
                  if (r.ok) {
                    setSheet(null);
                    setNote("");
                  }
                }}
              >
                <p className="font-display text-lg">
                  {sheet === "arrival"
                    ? "We’ll hold a curb stall."
                    : "When should we have it ready?"}
                </p>
                <label className="mt-3 block text-xs font-bold">When</label>
                <input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="mt-1 mb-3 w-full rounded-xl border border-line bg-cream px-3 py-3 text-sm"
                />
                <label className="block text-xs font-bold">Anything we should know?</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Child seat, groceries, charge to 80%…"
                  className="mt-1 mb-3 w-full rounded-xl border border-line bg-cream px-3 py-3 text-sm"
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="gold">
                    Save this for me
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSheet(null)}>
                    Never mind
                  </Button>
                </div>
              </form>
            ) : null}
            <h2 className="font-display text-xl">Your requests</h2>
            <div className="flex flex-col gap-3">
              {mine
                .filter(
                  (t) =>
                    t.id !== live?.id &&
                    t.status !== "cancelled" &&
                    t.status !== "released",
                )
                .map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    audience="resident"
                    onCancel={
                      t.status === "open"
                        ? () => {
                            if (!window.confirm("Cancel this request?")) return;
                            const r = cancel(t.id);
                            toast[r.ok ? "success" : "error"](r.message);
                          }
                        : undefined
                    }
                  />
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
