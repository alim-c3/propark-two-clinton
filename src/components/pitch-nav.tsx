"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/features", label: "Features" },
  { to: "/resident", label: "Resident" },
  { to: "/valet", label: "Valet" },
  { to: "/manager", label: "Manager" },
] as const;

export function PitchNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-20 border-b border-navy-2 bg-navy text-cream">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="shrink-0 leading-tight">
          <span className="block text-[10px] font-bold tracking-[0.18em] text-gold">
            PROPARK
          </span>
          <span className="block font-display text-lg leading-none">Runway</span>
        </Link>
        <p className="hidden min-w-0 flex-1 text-xs text-cream/55 sm:block">
          For condo and apartment towers
        </p>
        <nav className="ml-auto flex flex-wrap justify-end gap-1">
          {LINKS.map((l) => {
            const on = path === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full px-3 py-2 text-xs font-semibold",
                  on ? "bg-gold text-navy" : "text-cream/75 hover:bg-navy-2",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
