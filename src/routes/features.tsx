import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PitchNav } from "@/components/pitch-nav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/features")({ component: Features });

const SEATS = [
  {
    id: "residents",
    kicker: "Residents",
    title: "Your car. Your place in line. Nobody else’s.",
    promise: "Ask now. See where you are. Get pinged when it’s ready.",
    demo: "/resident" as const,
    demoLabel: "Open resident",
    img: "/flow-resident.jpg",
    groups: [
      {
        h: "Ask for the car",
        items: [
          "Get going — one tap, confirm so it’s never an accident",
          "You’re 5th in line · 9 min — restaurant-style, not a ticket soup",
          "Text when we’re getting it. Text when it’s on the runway",
          "Cancel until a valet is already rolling",
        ],
      },
      {
        h: "While it’s parked",
        items: [
          "Your stall on screen — grab a phone or a bag anytime",
          "Standing pickup (Thu 7:05) — the garage already knew",
          "Schedule a time, or a drop-off / arrival",
          "Only your car. Neighbors stay private",
        ],
      },
      {
        h: "Keys & habits",
        items: [
          "Keys request: bring them to the lobby cabinet — nobody at the door",
          "Street cred — on-time pickups move you up; no-shows wait",
        ],
      },
    ],
  },
  {
    id: "valets",
    kicker: "Valets",
    title: "One car. Locked to you. Until it’s parked or ready.",
    promise: "See the car, the stall, the lift. Finish the job. Resident gets pinged.",
    demo: "/valet" as const,
    demoLabel: "Open valet",
    img: "/flow-valet.jpg",
    groups: [
      {
        h: "The job",
        items: [
          "Clock in. One car at a time — blocked until completed or parked",
          "Take it out or take it in — make · color, plate and apt smaller",
          "Lift UP or DOWN on the job. Dest stall named",
          "Park: spot number + map, then Task completed",
          "Nest named first — don’t pull until the blocker moves",
        ],
      },
      {
        h: "Find it. Ping keys.",
        items: [
          "Search make, model, or plate — the stall lights up",
          "Keys upstairs: search the car, confirm, text + email",
          "Resident ping: we’re getting it → car is ready",
          "Floor chat — valets only. Residents never see it",
        ],
      },
      {
        h: "Your shift",
        items: [
          "Cars, cars per hour, break time, last plates",
          "Check in / out. Break. Heading out counts the cabinet",
        ],
      },
    ],
  },
  {
    id: "managers",
    kicker: "Managers",
    title: "Will the rush get off the ground?",
    promise: "SLA, labor, occupancy, and tonight’s restack — on one board.",
    demo: "/manager" as const,
    demoLabel: "Open manager",
    img: "/flow-manager.jpg",
    groups: [
      {
        h: "The contract",
        items: [
          "Median minutes to curb vs 8 off-peak / 12 at rush",
          "Zero upstairs key walks — labor back to P2",
          "Coverage alert: call a third valet before you’re late",
          "Predicted vs actual pulls for the next 12 hours",
        ],
      },
      {
        h: "The deck",
        items: [
          "Host stand — make · color, plate · apt, place in line",
          "P2 map: green open, navy full, gold nested, ↑↓ stackers",
          "Tonight’s restack: Accept or leave it",
          "Street cred on the queue — grounded requests wait",
        ],
      },
      {
        h: "The crew",
        items: [
          "Per attendant: cars, pace, break, which plates they moved",
          "Who’s on, who’s on break, who’s off",
        ],
      },
    ],
  },
];

function Features() {
  return (
    <main className="min-h-screen bg-cream text-navy">
      <PitchNav />

      <section className="bg-navy text-cream">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-[10px] font-bold tracking-[0.18em] text-gold">
            FEATURE LIST
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl sm:text-5xl">
            Residents. Valets. Managers.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-cream/75">
            Everything in the live tower, by seat. Jump a section, or open the
            demo.
          </p>
          <nav className="mt-6 flex flex-wrap gap-2">
            {SEATS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex min-h-11 items-center rounded-full bg-gold px-4 text-sm font-semibold text-navy"
              >
                {s.kicker}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {SEATS.map((s) => (
        <section
          key={s.id}
          id={s.id}
          className="scroll-mt-16 border-b border-line bg-white"
        >
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-gold-2">
                {s.kicker.toUpperCase()}
              </p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">{s.title}</h2>
              <p className="mt-2 text-sm text-muted">{s.promise}</p>
              <div className="mt-8 space-y-6">
                {s.groups.map((g) => (
                  <div key={g.h}>
                    <h3 className="font-display text-xl">{g.h}</h3>
                    <ul className="mt-2 space-y-2">
                      {g.items.map((item) => (
                        <li key={item} className="flex gap-2 text-sm">
                          <Check
                            className="mt-0.5 size-4 shrink-0 text-ok"
                            strokeWidth={2.5}
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <Button asChild variant="gold" className="mt-8">
                <Link to={s.demo}>{s.demoLabel}</Link>
              </Button>
            </div>
            <img
              src={s.img}
              alt=""
              className="h-64 w-full rounded-2xl object-cover lg:sticky lg:top-20 lg:h-[28rem]"
            />
          </div>
        </section>
      ))}
    </main>
  );
}
