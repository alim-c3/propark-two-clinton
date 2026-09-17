"use client";

import { useMemo, useState } from "react";
import { Mail, Search, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type CarHit, fold, searchDeck } from "@/lib/search";
import { CONTACTS, STALLS } from "@/lib/seed";
import { useLane } from "@/lib/store";
import { cn } from "@/lib/utils";

function contactOf(unit?: string) {
  if (!unit) return undefined;
  const u = unit.replace(/^Guest\s+/i, "");
  return CONTACTS.find((c) => c.unit === u);
}

export function KeyReturn({ tone = "dark" }: { tone?: "light" | "dark" }) {
  const pingKeys = useLane((s) => s.pingKeys);
  const keyPings = useLane((s) => s.keyPings);
  const tickets = useLane((s) => s.tickets);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<CarHit | null>(null);
  const [confirm, setConfirm] = useState(false);
  const dark = tone === "dark";

  const hits = useMemo(
    () => searchDeck(q, STALLS, tickets).filter((h) => contactOf(h.unit)),
    [q, tickets],
  );
  const selected = contactOf(pick?.unit);
  const unit = selected?.unit;
  const waiting = unit
    ? keyPings.find((p) => p.unit === unit && p.status === "sent")
    : undefined;

  function choose(h: CarHit) {
    setPick(h);
    setConfirm(false);
    setQ(`${h.car} ${h.plate}`);
  }

  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        dark ? "border-navy-2 bg-navy-2 text-cream" : "border-line bg-white text-navy",
      )}
    >
      <p className="text-[10px] font-bold tracking-[0.16em] text-gold">
        KEYS WENT UPSTAIRS
      </p>
      <p className={cn("mt-1 text-xs", dark ? "text-cream/60" : "text-muted")}>
        Find the car — make, model, or plate. Don’t walk upstairs. Text + email
        — they bring keys to Cabinet 07.
      </p>

      <label className="relative mt-3 block">
        <Search
          className={cn(
            "pointer-events-none absolute top-3.5 left-3 size-4",
            dark ? "text-cream/50" : "text-muted",
          )}
        />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPick(null);
            setConfirm(false);
          }}
          placeholder="Tesla, HST-4412, Pilot…"
          autoComplete="off"
          className={cn(
            "w-full rounded-xl border py-3 pr-3 pl-10 text-sm",
            dark
              ? "border-navy bg-navy text-cream placeholder:text-cream/40"
              : "border-line bg-cream text-navy placeholder:text-muted",
          )}
        />
      </label>

      {fold(q).length >= 2 && !pick ? (
        <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
          {hits.length ? (
            hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => choose(h)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm",
                    dark
                      ? "bg-navy text-cream hover:bg-navy-2"
                      : "bg-cream text-navy hover:bg-line",
                  )}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{h.car}</span>
                    <span
                      className={cn(
                        "block text-xs",
                        dark ? "text-cream/55" : "text-muted",
                      )}
                    >
                      {h.plate} · APT {h.unit}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-lg">{h.where}</span>
                </button>
              </li>
            ))
          ) : (
            <li className={cn("px-1 py-2 text-sm", dark ? "text-cream/60" : "text-muted")}>
              No resident car matches. Try plate or model.
            </li>
          )}
        </ul>
      ) : q.trim() && !pick ? (
        <p className={cn("mt-2 text-sm", dark ? "text-cream/60" : "text-muted")}>
          Keep typing — make, model, or plate.
        </p>
      ) : null}

      {selected && pick ? (
        <div
          className={cn(
            "mt-3 space-y-2 rounded-xl px-3 py-3 text-sm",
            dark ? "bg-navy" : "bg-cream",
          )}
        >
          <p className="font-display text-xl">
            {pick.car}
          </p>
          <p className={cn("text-xs", dark ? "text-cream/55" : "text-muted")}>
            {pick.plate} · APT {selected.unit}
          </p>
          <p className="flex items-center gap-2">
            <Smartphone className="size-4 shrink-0 text-gold" />
            SMS · {selected.phone}
          </p>
          <p className="flex items-center gap-2">
            <Mail className="size-4 shrink-0 text-gold" />
            Email · {selected.email}
          </p>
          <p className={cn("text-xs leading-relaxed", dark ? "text-cream/60" : "text-muted")}>
            “ProPark Runway: please bring keys for the {pick.car} ({pick.plate})
            · APT {selected.unit} to Cabinet 07. We will not come upstairs.”
          </p>
        </div>
      ) : null}

      {waiting ? (
        <p
          className={cn(
            "mt-3 rounded-xl px-3 py-3 text-center text-sm font-semibold",
            dark ? "border border-gold/40 bg-navy text-gold" : "bg-gold/20 text-navy",
          )}
        >
          Waiting on keys · {pick?.car} · {pick?.plate}
        </p>
      ) : confirm && selected && pick ? (
        <div
          className={cn(
            "mt-3 rounded-xl p-3",
            dark ? "border border-gold bg-navy" : "border border-gold bg-cream",
          )}
        >
          <p className="font-display text-lg">
            Text and email keys for {pick.car}?
          </p>
          <p className={cn("mt-1 text-sm", dark ? "text-cream/65" : "text-muted")}>
            {pick.plate} · APT {selected.unit}. They bring keys to Cabinet 07.
            Nobody walks upstairs.
          </p>
          <Button
            className="mt-3"
            variant="gold"
            size="block"
            onClick={() => {
              const r = pingKeys(selected.unit);
              toast[r.ok ? "success" : "error"](r.message);
              if (r.ok) setConfirm(false);
            }}
          >
            Send text + email
          </Button>
          <Button
            className="mt-2"
            variant={dark ? "ghostDark" : "ghost"}
            size="block"
            onClick={() => setConfirm(false)}
          >
            Never mind
          </Button>
        </div>
      ) : (
        <Button
          className={cn("mt-3", dark && "border-gold text-gold")}
          variant={dark ? "ghostDark" : "navy"}
          size="block"
          disabled={!selected}
          onClick={() => setConfirm(true)}
        >
          {selected ? "Ask for keys" : "Find a car first"}
        </Button>
      )}

      {keyPings.length ? (
        <ol className="mt-4 space-y-2">
          {keyPings.map((p) => (
            <li
              key={p.id}
              className={cn(
                "rounded-xl px-3 py-2 text-sm",
                dark ? "bg-navy" : "bg-cream",
              )}
            >
              <p className="font-semibold">
                {p.sms.includes("the ")
                  ? p.sms.split("the ")[1]?.split(" to Cabinet")[0]
                  : `APT ${p.unit} · ${p.name}`}
              </p>
              <p className={cn("text-xs", dark ? "text-cream/60" : "text-muted")}>
                {p.status === "sent"
                  ? `Sent · ${p.phone} · ${p.email}`
                  : "They confirmed. Keys coming down."}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
