"use client";

import { Button } from "@/components/ui/button";
import { stallDeck } from "@/lib/seed";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE: Record<Ticket["type"], string> = {
  now: "bg-gold/30 text-navy",
  scheduled: "bg-navy/10 text-navy",
  arrival: "bg-gold-2/20 text-gold-2",
  restack: "bg-navy text-cream",
};

const TYPE_DARK: Record<Ticket["type"], string> = {
  now: "bg-gold text-navy",
  scheduled: "bg-navy text-cream",
  arrival: "bg-gold-2/40 text-cream",
  restack: "bg-cream/15 text-cream",
};

const STATUS: Record<Ticket["status"], string> = {
  open: "Open",
  claimed: "Claimed",
  staged: "At curb",
  released: "Handed off",
  cancelled: "Cancelled",
};

export function TicketCard({
  ticket,
  tone = "light",
  action,
  onAction,
  onCancel,
  audience = "valet",
}: {
  ticket: Ticket;
  tone?: "light" | "dark";
  action?: string;
  onAction?: () => void;
  onCancel?: () => void;
  audience?: "resident" | "valet";
}) {
  const dark = tone === "dark";
  const resident = audience === "resident";
  return (
    <article
      className={cn(
        "rounded-2xl border p-4",
        dark ? "border-navy-2 bg-navy-2/60 text-cream" : "border-line bg-white text-navy",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {resident ? ticket.car : `${ticket.car} · ${ticket.color}`}
          </p>
          <p className={cn("text-xs", dark ? "text-cream/55" : "text-muted")}>
            {resident
              ? `${ticket.plate} · ${ticket.due}`
              : `${ticket.plate} · APT ${ticket.unit}${
                  stallDeck(ticket.stall)?.liftDeck === "upper"
                    ? " · ↑"
                    : stallDeck(ticket.stall)?.liftDeck === "lower"
                      ? " · ↓"
                      : ""
                } · ${ticket.stall} · ${ticket.due}`}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
            dark ? TYPE_DARK[ticket.type] : TYPE[ticket.type],
          )}
        >
          {ticket.type}
        </span>
      </div>
      {!resident && ticket.blockedBy ? (
        <p className="mt-2 text-sm text-gold-2">Move {ticket.blockedBy} first</p>
      ) : null}
      {!resident && ticket.note ? (
        <p className={cn("mt-2 text-sm", dark ? "text-cream/70" : "text-muted")}>
          {ticket.note}
        </p>
      ) : null}
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gold-2">
        {STATUS[ticket.status]}
        {!resident && ticket.valet ? ` · ${ticket.valet}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onAction && action ? (
          <Button variant={dark ? "gold" : "navy"} size="sm" onClick={onAction}>
            {action}
          </Button>
        ) : null}
        {onCancel && ticket.status === "open" ? (
          <Button variant="danger" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </article>
  );
}
