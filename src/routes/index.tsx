import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PitchNav } from "@/components/pitch-nav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

const VALUE = [
  {
    kicker: "Residents",
    title: "You’re 5th in line · 9 min.",
    body: "One tap. A place in line. A wait they can trust. Their stall if they need a bag. Nobody else’s car.",
  },
  {
    kicker: "Valets",
    title: "The next car. The stall. The lift.",
    body: "Make · color · plate. Nest named before they pull. Lift UP or DOWN. Park on the map, then Task completed.",
  },
  {
    kicker: "Managers",
    title: "Coverage before the rush.",
    body: "SLA to curb. Cars per hour. Breaks. Who moved which plate. Call a third valet while there’s still time.",
  },
  {
    kicker: "Everyone",
    title: "Keys without the walk.",
    body: "They took the keys upstairs. Search Tesla or the plate. Text + email. Keys come to the lobby. The retrieve stays on P2.",
  },
];

const SEATS = [
  {
    href: "/features#residents",
    kicker: "Residents",
    title: "The amenity they actually use.",
    items: [
      "Get going — one tap",
      "Place in line + wait",
      "Your stall on screen",
      "Text when it’s ready",
    ],
    img: "/flow-resident.jpg",
  },
  {
    href: "/features#valets",
    kicker: "Valets",
    title: "One job until it’s done.",
    items: [
      "Take it in or out",
      "Map + dest stall",
      "Ping keys by car",
      "Shift: cars / hour",
    ],
    img: "/flow-valet.jpg",
  },
  {
    href: "/features#managers",
    kicker: "Managers",
    title: "Proof you can show a board.",
    items: [
      "Median minutes to curb",
      "Predicted vs actual",
      "Restack as a decision",
      "Attendant scorecard",
    ],
    img: "/flow-manager.jpg",
  },
];

function Home() {
  return (
    <main className="min-h-screen bg-navy text-cream">
      <PitchNav />

      <div className="relative overflow-hidden">
        <img
          src="/clinton-hero.jpg"
          alt="Two Clinton Park, New Rochelle"
          className="h-[28rem] w-full object-cover object-[center_35%] sm:h-[34rem]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-navy/20" />
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 sm:px-10">
          <p className="text-xs font-bold tracking-[0.2em] text-gold">
            VALET FOR CONDO AND APARTMENT TOWERS
          </p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl text-cream sm:text-6xl">
            Get going. We’ll help you take off.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-cream/90 sm:text-base">
            Residents see their place in line. Valets see the next car, the
            stall, and the lift. Managers see coverage before the rush. Keys
            come down by text — nobody walks upstairs.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="gold">
              <Link to="/resident">Open resident app</Link>
            </Button>
            <Button asChild variant="ghostDark">
              <Link to="/features">Feature list</Link>
            </Button>
          </div>
        </div>
      </div>

      <section className="border-y border-navy-2 bg-navy-2">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE.map((v) => (
            <article key={v.kicker}>
              <p className="text-[10px] font-bold tracking-[0.18em] text-gold">
                {v.kicker.toUpperCase()}
              </p>
              <h2 className="mt-2 font-display text-2xl">{v.title}</h2>
              <p className="mt-2 text-sm text-cream/70">{v.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-gold">
              FEATURES BY SEAT
            </p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl">
              What each person actually gets.
            </h2>
            <p className="mt-2 max-w-lg text-sm text-cream/70">
              Three products, one garage. Tap a seat for the full list — or
              jump the live demo.
            </p>
          </div>
          <Button asChild variant="gold">
            <Link to="/features">Open the feature list</Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {SEATS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="group overflow-hidden rounded-2xl border border-navy-2 bg-navy-2"
            >
              <img
                src={s.img}
                alt=""
                className="h-40 w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="p-5">
                <p className="text-[10px] font-bold tracking-[0.16em] text-gold">
                  {s.kicker.toUpperCase()}
                </p>
                <h3 className="mt-1 font-display text-2xl">{s.title}</h3>
                <ul className="mt-3 space-y-1 text-sm text-cream/75">
                  {s.items.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold">
                  Full {s.kicker.toLowerCase()} list <ArrowRight className="size-4" />
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="border-t border-navy-2">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-[10px] font-bold tracking-[0.18em] text-gold">
            LIVE TOWER · TWO CLINTON PARK
          </p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl">
            Same product. Real garage. Sample residents.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-cream/70">
            50 Clinton Place, New Rochelle. ProPark on the curb. Eight minutes:
            resident Get going → valet nest → car is ready → they see the
            text.
          </p>
          <ol className="mt-4 max-w-xl space-y-1 text-sm text-cream/80">
            <li>1. Resident — stall B-14, Get going</li>
            <li>2. Valet — clock in, Tesla, move B-13, lift, Car is ready</li>
            <li>3. Resident — ping + ready on the runway</li>
            <li>4. More on the floor — search Tesla, ping keys</li>
            <li>5. Manager — host stand, map, coverage</li>
          </ol>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="gold">
              <Link to="/resident">Start as resident</Link>
            </Button>
            <Button asChild variant="ghostDark">
              <Link to="/valet">Valet</Link>
            </Button>
            <Button asChild variant="ghostDark">
              <Link to="/manager">Manager</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
