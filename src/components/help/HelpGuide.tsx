const sections = [
  {
    id: "overview",
    title: "The shift",
    body: "CargoLink is ops structure for space truckers — how you'd handle jobs day to day, with a role-playing edge for Star Citizen hauls. Everything stays in your browser.",
    bullets: [
      "Home — why this exists and how a haul is shaped",
      "Contracts — Manifest, Flight plan, On the road",
      "Map — yards and jump points across Pyro, Stanton, and Nyx",
    ],
  },
  {
    id: "manifest",
    title: "Manifest",
    body: "Get jobs on the board. Upload mobiGlas contract screenshots; OCR fills pickup, dropoff, cargo, and reward. Fix anything that looks wrong before you leave the hangar.",
    bullets: [
      "Accept the contracts you want in-game, then press Print Screen on each one",
      "Those screenshots land in Roberts Space Industries\\StarCitizen\\LIVE\\Screenshots",
      "First time: set scan regions for Name, Primary objective, and Reward",
      "Upload the screenshots in batch, then edit locations and cargo with autocomplete",
      "Unmatched OCR text shows as suggestion chips under the field",
    ],
  },

  {
    id: "flight-plan",
    title: "Flight plan",
    body: "Set capacity and range, pick which contracts you're taking, then generate a route that respects jump gates and what the ship can carry.",
    bullets: [
      "Ship capacity (SCU), max range per tank (GM), starting location",
      "Review visits — reorder, add stops, or clear and rebuild",
      "Gateways appear when a haul crosses systems",
    ],
  },
  {
    id: "on-the-road",
    title: "On the road",
    body: "Fly the route stop by stop. Mark pickups and dropoffs as you clear them in-game.",
    bullets: [
      "Build a flight plan first — the flow graph needs a route",
      "Check off each action at the active stop",
      "Mark a whole contract done from the sidebar when it's finished",
    ],
  },
  {
    id: "tips",
    title: "Local log",
    body: "Contracts, scan regions, and routes live in this browser only. They persist on reload but do not sync across devices.",
    bullets: [
      "Clear all on Manifest wipes contracts and screenshots",
      "Clear route on Flight plan resets only the plan",
      "Theme toggle is in the header",
    ],
  },
] as const;

export function HelpGuide() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-20 space-y-3">
          <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {section.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {section.body}
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {section.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
