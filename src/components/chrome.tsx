"use client";

import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useLane } from "@/lib/store";
import { cn } from "@/lib/utils";

const ROLES = [
  { to: "/features", label: "Features" },
  { to: "/resident", label: "Resident" },
  { to: "/valet", label: "Valet" },
  { to: "/manager", label: "Manager" },
] as const;

export function Chrome({
  tone = "light",
}: {
  tone?: "light" | "dark";
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const reset = useLane((s) => s.reset);
  const dark = tone === "dark";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [path]);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3",
        dark
          ? "border-navy-2 bg-navy text-cream"
          : "border-line bg-cream text-navy",
      )}
    >
      <Link to="/" className="shrink-0 leading-tight">
        <span className="block text-[10px] font-bold tracking-[0.18em] text-gold-2">
          PROPARK
        </span>
        <span className="block font-display text-lg leading-none">Runway</span>
      </Link>
      <p className="hidden min-w-0 flex-1 text-xs text-muted sm:block">
        Two Clinton Park · 50 Clinton Place
      </p>
      <nav className="ml-auto flex flex-wrap justify-end gap-1">
        {ROLES.map((r) => {
          const on = path.startsWith(r.to);
          return (
            <Link
              key={r.to}
              to={r.to}
              className={cn(
                "rounded-full px-3 py-2 text-xs font-semibold min-h-10 inline-flex items-center",
                on
                  ? "bg-gold text-navy"
                  : dark
                    ? "text-cream/70 hover:bg-navy-2"
                    : "text-muted hover:bg-white",
              )}
            >
              {r.label}
            </Link>
          );
        })}
        <button
          type="button"
          className={cn(
            "inline-flex min-h-10 items-center rounded-full px-3 text-xs font-semibold",
            dark ? "text-cream/55 hover:bg-navy-2" : "text-muted hover:bg-white",
          )}
          onClick={() => {
            if (!window.confirm("Reset the live tower?")) return;
            reset();
            toast.success("Demo reset. Start at Resident → Get going.");
          }}
        >
          Reset
        </button>
      </nav>
    </header>
  );
}
