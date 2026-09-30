"use client";

import { createFileRoute } from "@tanstack/react-router";
import { enforceEvalNavigation } from "@/lib/eval/guard";
import { toast } from "sonner";
import { YourShift } from "@/components/attendant-board";
import { Chrome } from "@/components/chrome";
import { DemoBar, Flip } from "@/components/demo-bar";
import { GarageMap } from "@/components/garage-map";
import { KeyReturn } from "@/components/key-return";
import { TicketCard } from "@/components/ticket-card";
import { Button } from "@/components/ui/button";
import { ValetChat } from "@/components/valet-chat";
import { HostStand } from "@/components/wait-list";
import { scoreMap } from "@/lib/cred";
import { retrieveQueue } from "@/lib/queue";
import { runPlan, stallCode } from "@/lib/run";
import { CONTACTS } from "@/lib/seed";
import { useLane } from "@/lib/store";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/valet")({
  beforeLoad: () => enforceEvalNavigation("/valet"),
  component: Valet,
});

function jobAction(
  t: Ticket,
): { verb: "claim" | "finish"; label: string } | null {
  const plan = runPlan(t);
  if (t.status === "open") {
    return {
      verb: "claim",
      label: plan.dir === "in" ? "Take it in" : plan.dir === "out" ? "Take it out" : "I’ve got this",
    };
  }
  if (t.status === "claimed" || t.status === "staged") {
    return {
      verb: "finish",
      label: plan.dir === "in" ? "Done — parked" : "Done and ping resident",
    };
  }
  return null;
}

function Valet() {
  const tickets = useLane((s) => s.tickets);
  const staff = useLane((s) => s.staff);
  const clock = useLane((s) => s.clock);
  const setBreak = useLane((s) => s.setBreak);
  const onBreak = useLane((s) => s.onBreak);
  const advance = useLane((s) => s.advance);
  const unnest = useLane((s) => s.unnest);
  const liftCar = useLane((s) => s.lift);
  const takeCar = useLane((s) => s.takeCar);
  const cred = useLane((s) => s.cred);

  const open = tickets.filter((t) => t.status !== "released" && t.status !== "cancelled");
  const mine = open.find((t) => t.valet === "You" && (t.status === "claimed" || t.status === "staged"));
  const oldestNow = retrieveQueue(tickets, scoreMap(cred, CONTACTS.map((c) => c.unit))).find((t) => t.status === "open");
  const next = mine ?? oldestNow;
  const others = open.filter((t) => t.id !== next?.id);
  const action = next ? jobAction(next) : null;
  const plan = next ? runPlan(next) : null;
  const destStall = next ? next.toStall ?? (plan ? stallCode(plan.to) : null) ?? plan?.to : undefined;
  const parking = Boolean(next && plan?.dir === "in" && next.status === "claimed");
  const locked = Boolean(mine && (mine.status === "claimed" || mine.status === "staged"));

  function run(t: Ticket) {
    const a = jobAction(t);
    if (!a) return;
    if (a.verb === "claim") {
      let r = advance(t.id);
      if (!r.ok) { toast.error(r.message); return; }
      const afterClaim = useLane.getState().tickets.find((x) => x.id === t.id);
      if (afterClaim?.blockedBy) {
        r = unnest(t.id);
        if (!r.ok) { toast.error(r.message); return; }
      }
      const afterNest = useLane.getState().tickets.find((x) => x.id === t.id);
      const planNow = runPlan(afterNest ?? t);
      if (afterNest && planNow.lift !== "none" && !afterNest.liftedAt) {
        r = liftCar(t.id);
        if (!r.ok) { toast.error(r.message); return; }
      }
      toast.success(planNow.dir === "in" ? "Park it on the green stall." : "Resident pinged — we’re bringing the car up.");
      return;
    }
    let r = advance(t.id);
    if (!r.ok) { toast.error(r.message); return; }
    const after = useLane.getState().tickets.find((x) => x.id === t.id);
    if (after?.status === "staged") r = advance(t.id);
    toast[r.ok ? "success" : "error"](r.ok ? "Resident pinged — car is ready." : r.message);
  }

  return (
    <div className="min-h-screen bg-navy text-cream">
      <Chrome tone="dark" />
      <div className={cn("mx-auto max-w-lg px-4 py-6", staff.you && action && "pb-28")}>
        <DemoBar tone="dark" />
        <p className="mt-4 text-[10px] font-bold tracking-[0.18em] text-gold">VALET RUNWAY · CLINTON PLACE</p>
        <h1 className="mt-2 font-display text-3xl">
          {!staff.you ? "Clock in. Then take the next car."
            : parking ? "Park it. Green stall is yours."
            : next ? next.blockedBy ? `Nest first. ${next.blockedBy} is in the way.` : plan ? `${plan.from} → ${plan.to}` : "This is the car."
            : "Waiting on Get going."}
        </h1>

        {!staff.you ? (
          <section className="mt-5 overflow-hidden rounded-2xl border border-navy-2 bg-navy-2">
            <img src="/flow-valet.jpg" alt="" className="h-48 w-full object-cover object-center" />
            <div className="p-4">
              <p className="font-display text-2xl">I’m on the runway</p>
              <Button className="mt-4" variant="gold" size="block" onClick={() => { const r = clock(true); toast[r.ok ? "success" : "error"](r.message); }}>I’m on the runway</Button>
            </div>
          </section>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-navy-2 bg-navy-2 px-4 py-3">
              <p className="text-sm text-cream/70">{onBreak ? "On break" : "On duty · You"}</p>
              <div className="flex gap-2">
                <Button variant="ghostDark" size="sm" onClick={() => { const r = setBreak(!onBreak); toast[r.ok ? "success" : "error"](r.message); }}>{onBreak ? "I’m back" : "Break"}</Button>
                <Button variant="ghostDark" size="sm" onClick={() => { const r = clock(false); toast[r.ok ? "success" : "error"](r.message); }}>Heading out</Button>
              </div>
            </div>

            {parking && next ? (
              <section className="mt-4 rounded-2xl border border-gold/40 bg-navy-2 p-4">
                <p className="text-[10px] font-bold tracking-[0.16em] text-gold">TAKE IT IN</p>
                <p className="mt-2 font-display text-4xl leading-none text-gold">{plan?.from} → {destStall}</p>
                <p className="mt-2 text-sm text-cream/70">{next.car} · {next.color} · {next.plate}. Green stall blinks.</p>
                <div className="mt-3">
                  <GarageMap compact tone="dark" dest={destStall} highlight={destStall} onPick={(id) => { const r = takeCar(id); if (r.message) toast[r.ok ? "success" : "error"](r.message); }} />
                </div>
                {action ? <Button className="mt-4 hidden sm:flex" variant="gold" size="block" onClick={() => run(next)}>{action.label}</Button> : null}
              </section>
            ) : next ? (
              <section className="mt-4 overflow-hidden rounded-2xl border border-gold/40 bg-navy-2">
                <div className="p-4">
                  <p className="text-[10px] font-bold tracking-[0.16em] text-gold">{plan?.dir === "in" ? "TAKE IT IN" : plan?.dir === "out" ? "TAKE IT OUT" : "DO THIS NEXT"}</p>
                  <p className="mt-2 font-display text-4xl leading-tight text-gold">{plan ? `${plan.from} → ${plan.to}` : next.stall}</p>
                  <p className="mt-2 font-display text-xl">{next.car} · {next.color}</p>
                  <p className="text-xs text-cream/55">{next.plate} · APT {next.unit}</p>
                  {plan ? <p className="mt-3 rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-navy">{plan.liftLabel}. {plan.destLabel}.</p> : null}
                  {next.blockedBy ? <p className="mt-3 rounded-xl bg-gold/80 px-3 py-2 text-sm font-semibold text-navy">Nest first. {next.blockedBy} is in the way.</p> : null}
                  {locked && plan?.dir === "out" ? (
                    <p className="mt-3 rounded-xl border border-gold/50 bg-navy px-3 py-2 text-sm text-gold">
                      {next.status === "claimed" ? "Resident pinged: we’re bringing the car up." : "Resident pinged: car is ready at the curb."}
                    </p>
                  ) : null}
                  {action ? <Button className="mt-4 hidden sm:flex" variant="gold" size="block" onClick={() => run(next)}>{action.label}</Button> : null}
                  {locked && next.status === "claimed" && plan?.dir === "out" ? <Flip to="/resident" label="Resident was pinged" why="They see we’re bringing the car up." tone="dark" /> : null}
                  {next.status === "staged" && plan?.dir === "out" ? <Flip to="/resident" label="Open resident — car is ready" why="Timer is running on their phone." tone="dark" /> : null}
                </div>
              </section>
            ) : (
              <section className="mt-5 rounded-2xl border border-gold/40 bg-navy-2 p-4">
                <p className="font-display text-2xl">Runway is clear.</p>
                <Flip to="/resident" label="Open resident — Get going" why="That’s the demo." tone="dark" />
              </section>
            )}

            <div className="mt-6 space-y-6">
              <YourShift />
              <HostStand tickets={tickets} staff={staff} tone="dark" />
              <KeyReturn />
              {!parking ? (
                <GarageMap tone="dark" highlight={next?.stall === "curb" ? next?.toStall : next?.stall} dest={plan ? stallCode(plan.to) ?? undefined : undefined} onPick={(id) => {
                  if (locked && next?.type !== "arrival") { toast.error("Finish this car first."); return; }
                  const r = takeCar(id);
                  if (r.message) toast[r.ok ? "success" : "error"](r.message);
                }} />
              ) : null}
              {others.length ? (
                <>
                  <h2 className="font-display text-xl">After this</h2>
                  <div className="flex flex-col gap-3">
                    {others.map((t) => {
                      const a = jobAction(t);
                      const mineJob = t.status === "open" || t.valet === "You";
                      return (
                        <TicketCard key={t.id} ticket={t} tone="dark" action={!locked && mineJob ? a?.label : undefined} onAction={!locked && mineJob && a ? () => run(t) : undefined} />
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </>
        )}

        <div className="mt-8"><ValetChat /></div>

        {staff.you && next && action ? (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-navy-2 bg-navy p-3 sm:hidden">
            <Button variant="gold" size="block" onClick={() => run(next)}>{action.label}</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
