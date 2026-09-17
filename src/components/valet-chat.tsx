"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLane } from "@/lib/store";
import { clockLabel, cn } from "@/lib/utils";

const QUICK = [
  "On the lift",
  "At the curb",
  "Nest first",
  "Need a second",
  "Keys in 07",
  "Taking a break",
  "Back on the floor",
  "Hold the ramp",
];

export function ValetChat({ tone = "dark" }: { tone?: "light" | "dark" }) {
  const chat = useLane((s) => s.chat);
  const postChat = useLane((s) => s.postChat);
  const [draft, setDraft] = useState("");
  const dark = tone === "dark";
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.length]);

  function send(text: string) {
    const r = postChat(text);
    if (!r.ok) toast.error(r.message);
    else setDraft("");
  }

  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        dark ? "border-navy-2 bg-navy-2 text-cream" : "border-line bg-white text-navy",
      )}
    >
      <p className="text-[10px] font-bold tracking-[0.16em] text-gold">
        FLOOR CHAT · VALETS ONLY
      </p>
      <p className={cn("mt-1 text-xs", dark ? "text-cream/60" : "text-muted")}>
        Luis, Ana, Derrick, you. Residents never see this.
      </p>

      <ol className="mt-3 flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
        {chat.map((m) => {
          if (m.kind === "system") {
            return (
              <li key={m.id} className="flex justify-center">
                <p
                  className={cn(
                    "max-w-[90%] rounded-full px-3 py-1 text-center text-[10px]",
                    dark ? "bg-navy text-cream/60" : "bg-cream text-muted",
                  )}
                >
                  {m.body}
                </p>
              </li>
            );
          }
          const mine = m.from === "You";
          return (
            <li
              key={m.id}
              className={cn("flex", mine ? "justify-end" : "justify-start")}
            >
              <div className={cn("max-w-[80%]", mine ? "items-end" : "items-start")}>
                <p
                  className={cn(
                    "mb-1 text-[10px] font-bold tracking-wide",
                    mine ? "text-right text-gold-2" : "text-gold-2",
                  )}
                >
                  {mine ? "You" : m.from}
                  {" · "}
                  <span className={cn("font-normal", dark ? "text-cream/40" : "text-muted")}>
                    {clockLabel(m.at)}
                  </span>
                </p>
                <p
                  className={cn(
                    "px-3 py-2 text-sm leading-snug",
                    mine
                      ? "rounded-2xl rounded-br-sm bg-gold text-navy"
                      : dark
                        ? "rounded-2xl rounded-bl-sm bg-navy text-cream"
                        : "rounded-2xl rounded-bl-sm bg-cream text-navy",
                  )}
                >
                  {m.body}
                </p>
              </div>
            </li>
          );
        })}
        <div ref={end} />
      </ol>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK.map((line) => (
          <button
            key={line}
            type="button"
            onClick={() => send(line)}
            className={cn(
              "min-h-11 rounded-full border px-3 text-xs font-semibold",
              dark
                ? "border-navy bg-navy text-cream hover:border-gold hover:text-gold"
                : "border-line bg-cream text-navy hover:border-gold-2",
            )}
          >
            {line}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Or type it…"
          className={cn(
            "min-h-11 flex-1 rounded-full border px-4 text-sm",
            dark
              ? "border-navy bg-navy text-cream placeholder:text-cream/40"
              : "border-line bg-cream text-navy",
          )}
        />
        <Button type="submit" variant="gold" size="sm">
          Send
        </Button>
      </form>
    </section>
  );
}
