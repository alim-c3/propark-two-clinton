"use client";

import { useLane } from "@/lib/store";
import { cn } from "@/lib/utils";

export function BuyProof({ tone = "light" }: { tone?: "light" | "dark" }) {
  const pulls = useLane((s) => s.pulls);
  const pings = useLane((s) => s.keyPings);
  const tickets = useLane((s) => s.tickets);
  const staff = useLane((s) => s.staff);

  const n = pulls.length;
  const avg = n ? Math.round(pulls.reduce((a, p) => a + p.mins, 0) / n) : 0;
  const under12 = n ? Math.round((100 * pulls.filter((p) => p.mins <= 12).length) / n) : 0;
  const nests = pulls.filter((p) => p.nest).length;
  const onFloor = Object.values(staff).filter(Boolean).length;
  const liveNest = tickets.filter(
    (t) => t.blockedBy && t.status !== "cancelled" && t.status !== "released",
  ).length;
  const dark = tone === "dark";

  const tiles = [
    {
      k: "SLA TO CURB",
      v: `${avg} min`,
      s: `${under12}% under 12 · target 8 off-peak / 12 peak`,
    },
    {
      k: "WALKS UPSTAIRS",
      v: "0",
      s: pings.length
        ? `${pings.length} key ping${pings.length === 1 ? "" : "s"} · Cabinet 07`
        : "Ping the unit. Luis never leaves P2.",
    },
    {
      k: "NESTS NAMED",
      v: String(liveNest),
      s: `${nests} nest pulls this shift · named before they claim`,
    },
    {
      k: "AM COVERAGE",
      v: `${onFloor} / 3`,
      s: onFloor >= 3 ? "Wave is staffed" : "Call a third valet before 6:30",
    },
  ];

  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        dark ? "border-navy-2 bg-navy-2 text-cream" : "border-line bg-white text-navy",
      )}
    >
      <p className="text-[10px] font-bold tracking-[0.16em] text-gold-2">
        SAMPLE TOWER · LAST 14 DAYS
      </p>
      <h2 className="mt-1 font-display text-xl">
        SLA, labor back, nest named.
      </h2>
      <p className={cn("mt-1 text-sm", dark ? "text-cream/65" : "text-muted")}>
        Contract is 8 minutes off-peak, 12 at rush. These numbers are this
        demo’s shift pulls — not a live feed from the curb.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.k}
            className={cn(
              "rounded-xl px-3 py-3",
              dark ? "bg-navy" : "bg-cream",
            )}
          >
            <p className="text-[10px] font-bold tracking-[0.14em] text-gold-2">
              {t.k}
            </p>
            <p className="font-display text-3xl tabular-nums">{t.v}</p>
            <p className={cn("mt-1 text-xs", dark ? "text-cream/60" : "text-muted")}>
              {t.s}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
