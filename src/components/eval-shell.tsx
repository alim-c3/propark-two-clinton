import type { ReactNode } from "react";

export function EvalShell({
  children,
  kicker = "RUNWAY",
}: {
  children: ReactNode;
  kicker?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4 py-10 text-cream">
      <div className="w-full max-w-md rounded-2xl border border-navy-2 bg-[#121b2c] p-7 shadow-2xl">
        <p className="text-[10px] font-bold tracking-[0.22em] text-gold">{kicker}</p>
        {children}
      </div>
    </main>
  );
}
