"use client";

import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLane } from "@/lib/store";
import { cn } from "@/lib/utils";

export function DemoBar({ tone = "light" }: { tone?: "light" | "dark" }) {
  const reset = useLane((s) => s.reset);
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2 text-xs",
        dark ? "bg-navy-2 text-cream/70" : "bg-white text-muted",
      )}
    >
      <p>Live tower · Two Clinton · reset anytime</p>
      <Button
        variant={dark ? "ghostDark" : "ghost"}
        size="sm"
        onClick={() => {
          if (!window.confirm("Reset the live tower?")) return;
          reset();
          toast.success("Demo reset. Start at Resident → Get going.");
        }}
      >
        Reset demo
      </Button>
    </div>
  );
}

export function Flip({
  to,
  label,
  why,
  tone = "light",
}: {
  to: "/resident" | "/valet" | "/manager";
  label: string;
  why: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <Link
      to={to}
      className={cn(
        "mt-4 block rounded-2xl border px-4 py-3",
        dark
          ? "border-gold bg-gold text-navy"
          : "border-gold bg-gold text-navy",
      )}
    >
      <p className="font-display text-lg">{label}</p>
      <p className="mt-0.5 text-sm opacity-80">{why}</p>
    </Link>
  );
}
