"use client";

import { Check } from "lucide-react";
import { runPlan } from "@/lib/run";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";

type Audience = "resident" | "valet";

type Step = {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  active: boolean;
};

export function retrieveSteps(t: Ticket, audience: Audience = "valet"): Step[] {
  const claimed =
    t.status === "claimed" || t.status === "staged" || t.status === "released";
  const nestClear = !t.blockedBy;
  const nested = Boolean(t.blockedBy) || Boolean(t.unnestedAt);
  const lifted = Boolean(t.liftedAt) || t.status === "staged" || t.status === "released";
  const staged = t.status === "staged" || t.status === "released";
  const released = t.status === "released";
  const resident = audience === "resident";
  const plan = runPlan(t);
  const inbound = plan.dir === "in";

  const steps: Step[] = [
    {
      key: "asked",
      label: inbound ? "They’re here" : "You asked",
      detail: t.due === "Now" ? "Get going" : t.due,
      done: true,
      active: false,
    },
    {
      key: "claimed",
      label: claimed
        ? resident
          ? "A valet has your car"
          : t.valet === "You"
            ? inbound
              ? "You have it at the curb"
              : "You have it"
            : `${t.valet ?? "A valet"} has it`
        : inbound
          ? "Waiting on the curb"
          : "Waiting for a valet",
      detail: claimed
        ? inbound
          ? "Clinton Place"
          : `From ${plan.from}`
        : "Usually under two minutes",
      done: claimed,
      active: t.status === "open",
    },
  ];

  if (nested && !resident) {
    steps.push({
      key: "nest",
      label: nestClear
        ? `${t.unnestedAt ? "Nest cleared" : "The way is clear"}`
        : `Move ${t.blockedBy} first`,
      detail: nestClear
        ? "Then the lift"
        : "Do not pull until the blocker moves",
      done: claimed && nestClear,
      active: claimed && !nestClear,
    });
  }

  if (!resident) {
    steps.push({
      key: "lift",
      label: lifted ? plan.liftLabel : plan.liftLabel,
      detail: lifted
        ? `Going to ${plan.to}`
        : plan.lift === "none"
          ? `Drive to ${plan.to}`
          : `Car lift · then ${plan.to}`,
      done: claimed && nestClear && (lifted || plan.lift === "none"),
      active:
        t.status === "claimed" &&
        nestClear &&
        !lifted &&
        plan.lift !== "none",
    });
  }

  steps.push(
    {
      key: "staged",
      label: staged
        ? inbound
          ? `Parked in ${plan.to}`
          : "At the Clinton Place curb"
        : inbound
          ? `Park in ${plan.to}`
          : "Rolling to the curb",
      detail: staged
        ? inbound
          ? "Keys next"
          : "Porte-cochère"
        : resident
          ? "We’ll text you"
          : plan.destLabel,
      done: staged,
      active: t.status === "claimed" && nestClear && (lifted || plan.lift === "none"),
    },
    {
      key: "released",
      label: released
        ? inbound
          ? "Keys in Cabinet 07"
          : "In your hands"
        : inbound
          ? "Keys in cabinet"
          : "Hand-off",
      detail: released
        ? inbound
          ? "Done"
          : "Drive safe"
        : inbound
          ? "Drop keys, you’re clear"
          : "We’ll wait with the car",
      done: released,
      active: t.status === "staged",
    },
  );

  return steps;
}

export function RetrieveStepper({
  ticket,
  tone = "light",
  audience = "valet",
}: {
  ticket: Ticket;
  tone?: "light" | "dark";
  audience?: Audience;
}) {
  const dark = tone === "dark";
  const steps = retrieveSteps(ticket, audience);

  return (
    <ol className="mt-4 flex flex-col gap-0">
      {steps.map((s, i) => (
        <li key={s.key} className="flex gap-3">
          <div className="flex w-6 flex-col items-center">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                s.done && "bg-ok text-cream",
                s.active && "bg-gold text-navy",
                !s.done && !s.active && (dark ? "bg-navy text-cream/40" : "bg-line text-muted"),
              )}
            >
              {s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "w-px flex-1",
                  s.done ? "bg-ok" : dark ? "bg-navy" : "bg-line",
                )}
              />
            ) : null}
          </div>
          <div className={cn("pb-4", i === steps.length - 1 && "pb-0")}>
            <p
              className={cn(
                "text-sm font-semibold",
                s.active && "text-gold-2",
                !s.active && !s.done && "text-muted",
              )}
            >
              {s.label}
            </p>
            <p className={cn("text-xs", dark ? "text-cream/60" : "text-muted")}>
              {s.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}