"use client";

import { createFileRoute } from "@tanstack/react-router";
import { enforceEvalNavigation } from "@/lib/eval/guard";
import { Mail, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chrome } from "@/components/chrome";
import { DemoBar } from "@/components/demo-bar";
import { TicketCard } from "@/components/ticket-card";
import { Button } from "@/components/ui/button";
import { CurbPager } from "@/components/wait-list";
import { RESIDENT_CHOICES, residentOf } from "@/lib/seed";
import { useLane } from "@/lib/store";
import type { Ticket } from "@/lib/types";
import { localInputValue, cn, useNow } from "@/lib/utils";

export const Route = createFileRoute("/resident")({
  beforeLoad: () => enforceEvalNavigation("/resident"),
  component: Resident,
});

function isLive(t: Ticket) {
  return t.status === "open" || t.status === "claimed" || t.status === "staged";
}

function returnWindows(now: number) {
  const start = new Date(now).getHours();
  const windows: string[] = [];
  for (let hour = start; hour < 24; hour++) {
    const from = hour % 12 === 0 ? 12 : hour % 12;
    const toHour = (hour + 1) % 24;
    const to = toHour % 12 === 0 ? 12 : toHour % 12;
    const fromSuffix = hour < 12 ? "am" : "pm";
    const toSuffix = toHour < 12 ? "am" : "pm";
    windows.push(
      fromSuffix === toSuffix
        ? `${from} to ${to} ${toSuffix}`
        : `${from} ${fromSuffix} to ${to} ${toSuffix}`,
    );
  }
  windows.push("Tomorrow", "More than 1 day");
  return windows;
}

function fmtReady(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function Resident() {
  const tickets = useLane((s) => s.tickets);
  const staff = useLane((s) => s.staff);
  const requestNow = useLane((s) => s.requestNow);
  const schedule = useLane((s) => s.schedule);
  const cancel = useLane((s) => s.cancel);
  const pushBack = useLane((s) => s.pushBack);
  const expectBack = useLane((s) => s.expectBack);
  const keyPings = useLane((s) => s.keyPings);
  const ackKeys = useLane((s) => s.ackKeys);
  const ridePings = useLane((s) => s.ridePings);
  const deskNotes = useLane((s) => s.deskNotes);
  const activeUnit = useLane((s) => s.activeUnit);
  const setActiveUnit = useLane((s) => s.setActiveUnit);
  const now = useNow();
  const me = residentOf(activeUnit);

  const mine = tickets.filter((t) => t.unit === me.unit && t.type !== "restack");
  const live =
    mine.find((t) => t.type === "now" && isLive(t)) ??
    mine.find((t) => t.type !== "arrival" && (t.status === "claimed" || t.status === "staged"));
  const standing = mine.find((t) => t.type === "scheduled" && t.status === "open" && t.due.includes("7:05"));
  const keyAsk = keyPings.find((p) => p.unit === me.unit && p.status === "sent");
  const ride = ridePings.find((p) => p.unit === me.unit);
  const desk = deskNotes.find((n) => n.unit === me.unit);

  const readyMs = live?.status === "staged" && live.stagedAt ? now - live.stagedAt : 0;
  const readyMin = readyMs / 60000;
  const ping5 = live?.status === "staged" && readyMin >= 5;
  const ping8 = live?.status === "staged" && readyMin >= 8;

  const [confirm, setConfirm] = useState(false);
  const [pullNote, setPullNote] = useState("");
  const [pushLine, setPushLine] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 45);
    return localInputValue(d);
  });
  const [note, setNote] = useState("");
  const [back, setBack] = useState("");
  const [pushMin, setPushMin] = useState("");

  const waiting = live?.type === "now" && live.status === "open";
  const h1 =
    live?.status === "staged" ? "Your car is ready on the runway."
    : live?.status === "claimed" ? "We’re bringing your car up."
    : `Hi ${me.first}. We’ll help you take off.`;
  const cap =
    live?.status === "staged" ? `Ready for ${fmtReady(readyMs)}. Clinton Place curb.`
    : live?.status === "claimed" ? "A valet has it on the lift. You’ll get a ping when it’s at the curb."
    : waiting ? ""
    : standing ? "Thursday 7:05 is on your list. The garage already knew."
    : `Your ${me.car} is downstairs in ${me.stall}${me.charge ? `, ${me.charge}%` : ""}.`;

  function go() {
    const parts = [pullNote.trim(), back ? `Expected back: ${back}.` : ""].filter(Boolean);
    const r = requestNow(parts.join(" ") || undefined);
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) {
      setConfirm(false);
      setPullNote("");
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  const carOut = live?.type === "now" && isLive(live);
  const backOptions = returnWindows(now);

  return (
    <div className="min-h-screen bg-cream">
      <Chrome />
      <div className="mx-auto max-w-lg px-4 py-6">
        <DemoBar />
        <div className="mt-4 flex flex-wrap gap-1">
          {RESIDENT_CHOICES.map((c) => (
            <button key={c.unit} type="button" onClick={() => setActiveUnit(c.unit)} className={cn("rounded-full px-3 py-2 text-xs font-semibold min-h-10", c.unit === me.unit ? "bg-gold text-navy" : "bg-white text-muted")}>
              Apt {c.unit}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[10px] font-bold tracking-[0.18em] text-gold-2">GOOD EVENING · APT {me.unit} · FLOOR {me.floor}</p>
        <h1 className="mt-2 font-display text-3xl text-navy">{h1}</h1>
        {cap ? <p className="mt-2 text-sm text-muted">{cap}</p> : null}

        {live?.status === "staged" ? (
          <section className="mt-4 rounded-2xl border border-gold bg-gold/20 p-4">
            <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">READY AT THE CURB</p>
            <p className="mt-1 font-display text-5xl tabular-nums text-navy">{fmtReady(readyMs)}</p>
            <p className="mt-1 text-sm text-navy/80">How long the car has been waiting for you.</p>
            {ping5 ? <p className="mt-3 rounded-xl bg-navy px-3 py-2 text-sm text-cream">Ping at 5:00 — your car is still on the runway.</p> : null}
            {ping8 ? <p className="mt-2 rounded-xl bg-navy px-3 py-2 text-sm text-cream">Ping at 8:00 — 3 minutes after the first reminder. Come down.</p> : null}
          </section>
        ) : null}

        {live?.status === "claimed" ? (
          <section className="mt-4 rounded-2xl border border-gold bg-gold/20 p-4">
            <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">TEXT · {me.phone}</p>
            <p className="mt-1 font-display text-xl text-navy">We’re bringing your car up.</p>
            <p className="mt-1 text-sm text-navy/80">Valet claimed it. You only get this ping on the way up — not when a car is going down.</p>
          </section>
        ) : null}

        <CurbPager tickets={tickets} staff={staff} mine={live?.type === "now" ? live : undefined} nested>
          {!live || live.type === "arrival" ? (
            !confirm ? (
              <Button variant="gold" size="block" onClick={() => setConfirm(true)}>Get going</Button>
            ) : (
              <div className="rounded-xl border border-gold bg-cream p-4">
                <p className="font-display text-lg text-navy">Ready to take off?</p>
                <input
                  value={pullNote}
                  onChange={(e) => setPullNote(e.target.value)}
                  placeholder="Add an optional note, e.g. child seat, groceries…"
                  className="mt-3 w-full rounded-full border border-line bg-white px-4 py-3 text-sm text-navy placeholder:text-muted"
                />
                <label className="mt-3 block">
                  <span className="text-sm font-semibold text-navy">Let us know when you’ll be back</span>
                  <select
                    value={backOptions.includes(back) ? back : ""}
                    onChange={(e) => setBack(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-3 text-base text-navy"
                  >
                    <option value="">Pick a time</option>
                    {backOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 flex flex-col gap-2">
                  <Button variant="gold" size="block" onClick={go}>Yes — let’s take off</Button>
                  <Button variant="ghost" size="block" onClick={() => { setConfirm(false); setPullNote(""); }}>Cancel car request</Button>
                </div>
              </div>
            )
          ) : null}
        </CurbPager>

        {live?.type === "now" && live.status === "open" ? (
          <div className="mt-3 space-y-2">
            <Button
              variant="danger"
              size="block"
              className="!bg-danger !text-cream hover:!bg-danger hover:!text-cream focus:!bg-danger focus:!text-cream active:!bg-danger active:!text-cream disabled:!bg-danger disabled:!text-cream disabled:!opacity-100"
              onClick={() => {
              if (!window.confirm("Cancel this pickup?")) return;
              const r = cancel(live.id);
              toast[r.ok ? "success" : "error"](r.message);
            }}>Cancel this pickup</Button>
            <div className="rounded-2xl border-2 border-gold bg-gold/25 p-4">
              <label className="block text-[10px] font-bold tracking-[0.16em] text-gold-2">PUSH BACK PICKUP</label>
              <select
                value={pushMin}
                onChange={(e) => {
                  const value = e.target.value;
                  setPushMin(value);
                  if (!value) {
                    setPushLine("");
                    return;
                  }
                  const minutes = Number(value);
                  const r = pushBack(live.id, minutes);
                  toast[r.ok ? "success" : "error"](r.message);
                  setPushLine(
                    r.ok
                      ? `You’ll be placed in the queue so your car is ready in ${minutes} min later.`
                      : "",
                  );
                }}
                className="mt-2 w-full rounded-xl border border-line bg-cream px-3 py-3 text-base text-navy"
              >
                <option value="">Choose how long</option>
                {[5, 10, 15, 20, 30, 45, 60, 90].map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} minutes</option>
                ))}
              </select>
              {pushLine ? <p className="mt-2 text-sm text-navy">{pushLine}</p> : null}
            </div>
          </div>
        ) : null}

        {carOut ? (
          <label className="mt-4 block rounded-2xl border-2 border-gold bg-white p-4">
            <span className="font-display text-lg text-navy">Let us know when you’ll be back</span>
            <select
              value={backOptions.includes(back) ? back : ""}
              onChange={(e) => {
                const value = e.target.value;
                setBack(value);
                if (!value) return;
                const r = expectBack(value);
                if (r.ok) toast.success(r.message);
              }}
              className="mt-2 w-full rounded-xl border border-line bg-cream px-3 py-3 text-base text-navy"
            >
              <option value="">Pick a time</option>
              {backOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mt-4 rounded-2xl border-2 border-navy bg-white p-4">
          <p className="font-display text-2xl text-navy">Schedule a car request</p>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-3 w-full rounded-xl border border-line bg-cream px-3 py-3 text-base text-navy" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Child seat, groceries…" className="mt-2 w-full rounded-xl border border-line bg-cream px-3 py-3 text-sm" />
          <Button className="mt-3" variant="gold" size="block" onClick={() => {
            const r = schedule("scheduled", when.replace("T", " "), note);
            toast[r.ok ? "success" : "error"](r.message);
            if (r.ok) setNote("");
          }}>Save this time</Button>
        </div>

        {desk ? (
          <section className="mt-4 rounded-2xl border border-gold bg-gold/20 p-4">
            <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">TEXT · {me.phone}</p>
            <p className="mt-1 font-display text-xl text-navy">Note from the desk</p>
            <p className="mt-1 text-sm text-navy/80">{desk.body}</p>
          </section>
        ) : null}

        {ride && live?.status !== "claimed" && live?.status !== "staged" ? (
          <section className="mt-4 rounded-2xl border border-gold bg-gold/20 p-4">
            <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">TEXT · {me.phone}</p>
            <p className="mt-1 font-display text-xl text-navy">{ride.kind === "ready" ? "Your car is ready on the runway." : "We’re getting your car."}</p>
            <p className="mt-1 text-sm text-navy/80">{ride.sms}</p>
          </section>
        ) : null}

        {keyAsk ? (
          <section className="mt-4 rounded-2xl border border-gold bg-gold/20 p-4">
            <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">KEYS · TEXT + EMAIL</p>
            <p className="mt-1 font-display text-xl text-navy">The garage needs your keys.</p>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl bg-white px-3 py-3 text-sm text-navy">
                <p className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-gold-2"><Smartphone className="size-3.5" /> TEXT · {me.phone}</p>
                <p className="mt-1">{keyAsk.sms}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-3 text-sm text-navy">
                <p className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-gold-2"><Mail className="size-3.5" /> EMAIL · {me.email}</p>
                <p className="mt-1 font-semibold">{keyAsk.emailSubject}</p>
              </div>
            </div>
            <Button className="mt-3" variant="navy" size="block" onClick={() => { const r = ackKeys(keyAsk.id); toast[r.ok ? "success" : "error"](r.message); }}>They’re in the cabinet</Button>
          </section>
        ) : null}

        <p className="mt-4 text-sm text-muted">
          {me.car} · {me.color} · {me.plate}
          {live?.status === "staged" ? " · at Clinton Place curb" : ` · ${me.stall}`}
        </p>

        <div className="mt-6 space-y-4">
          {standing ? (
            <p className="text-sm text-muted">Thursday 7:05 is already on your list.</p>
          ) : (
            <Button variant="navy" size="block" onClick={() => {
              const r = schedule("scheduled", me.standing ?? "Thu 7:05", "Standing Metro-North run — warm the cabin");
              toast[r.ok ? "success" : "error"](r.message);
            }}>Thursday 7:05</Button>
          )}
          <Button variant="navy" size="block" onClick={() => {
            const r = schedule("arrival", when.replace("T", " "), note || "On the way in");
            toast[r.ok ? "success" : "error"](r.message);
          }}>I’m on my way in</Button>
          <h2 className="font-display text-2xl">Your Upcoming and Requests</h2>
          <div className="flex flex-col gap-3">
            {mine.filter((t) => t.id !== live?.id && t.status !== "cancelled" && t.status !== "released").map((t) => (
              <TicketCard key={t.id} ticket={t} audience="resident" onCancel={t.status === "open" ? () => {
                if (!window.confirm("Cancel this request?")) return;
                const r = cancel(t.id);
                toast[r.ok ? "success" : "error"](r.message);
              } : undefined} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
